"use client";

import React, { useEffect, useState } from "react";
import { BarChart3, TrendingUp, CheckCircle2, AlertCircle, Clock, FolderKanban, ShieldCheck, Upload, FileText, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE } from "@/lib/api";

type Project = { id: string; name: string; status?: string; progress?: number; report_id?: string; report_title?: string };
type Task = { id: string; status?: string; due_date?: string };

function MetricBox({ label, value, sub, color }: { label: string; value: number | string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className={`text-sm font-semibold mt-1 ${color}`}>{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

export default function Reports() {
  const router = useRouter();
  const { user } = useAuth();
  const roleLower = (user?.role || "").toLowerCase();
  const isManager =
    roleLower.includes("manager") ||
    roleLower.includes("administrator") ||
    roleLower.includes("admin") ||
    roleLower.includes("lead");

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingProjectId, setUploadingProjectId] = useState<string | null>(null);

  const getToken = () =>
    (typeof window !== "undefined" && (localStorage.getItem("token") || localStorage.getItem("accessToken"))) || "";

  const handleReportUpload = async (project: Project, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProjectId(project.id);
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append("file", file);
      const upRes = await fetch(`${API_BASE}/reports/project/${project.id}/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok) {
        alert(upData.message || "Failed to upload report file.");
        return;
      }
      // Save extracted content to project_reports
      const saveRes = await fetch(`${API_BASE}/reports/project/${project.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: `${project.name} - Executive Report (${file.name})`,
          content: upData.content || `Uploaded report file: ${file.name}`,
          format: "PDF",
        }),
      });
      if (saveRes.ok) {
        setProjects(prev =>
          prev.map(p => (p.id === project.id ? { ...p, report_id: "saved", report_title: file.name } : p))
        );
        alert(`Report "${file.name}" uploaded and saved for ${project.name}.`);
      }
    } catch (err: any) {
      alert(err.message || "Error uploading report.");
    } finally {
      setUploadingProjectId(null);
      e.target.value = "";
    }
  };

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      if (!token) { router.push("/login"); return; }
      const headers: HeadersInit = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      try {
        const [projRes, myTasksRes] = await Promise.all([
          fetch(`${API_BASE}/projects`, { headers }).catch(() => null),
          fetch(`${API_BASE}/tasks/my/tasks`, { headers }).catch(() => null),
        ]);

        let allProjects: Project[] = [];
        if (projRes?.ok) {
          const projData = await projRes.json();
          allProjects = projData.projects || projData.data || [];
          setProjects(allProjects);
        }

        let allTasks: Task[] = [];
        if (isManager && allProjects.length > 0) {
          const taskArrays = await Promise.all(
            allProjects.map(async (p) => {
              const res = await fetch(`${API_BASE}/tasks/project/${p.id}`, { headers }).catch(() => null);
              if (!res || !res.ok) return [];
              const d = await res.json();
              return d.tasks || d.data || [];
            })
          );
          allTasks = taskArrays.flat();
        } else if (myTasksRes?.ok) {
          const d = await myTasksRes.json();
          allTasks = d.tasks || d.data || [];
        }
        setTasks(allTasks);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [router, isManager]);

  const done = tasks.filter(t => t.status === "Completed" || t.status === "Done").length;
  const inProgress = tasks.filter(t => t.status === "In Progress").length;
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "Completed" && t.status !== "Done").length;
  const completed = projects.filter(p => ["completed", "done"].includes((p.status || "").toLowerCase())).length;
  const rate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
  const avgProgress = projects.length > 0 ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length) : 0;

  if (loading) return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-1">Insights</p>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Organization-wide performance overview.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBox label="Tasks Completed" value={done} sub={`${rate}% completion rate`} color="text-emerald-600" />
        <MetricBox label="In Progress" value={inProgress} sub="currently active" color="text-blue-600" />
        <MetricBox label="Overdue Tasks" value={overdue} sub={overdue > 0 ? "needs attention" : "all on track"} color={overdue > 0 ? "text-rose-600" : "text-emerald-600"} />
        <MetricBox label="Projects Done" value={`${completed}/${projects.length}`} sub={`avg ${avgProgress}% progress`} color="text-violet-600" />
      </div>

      {/* Project health table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
          <FolderKanban size={15} className="text-indigo-500" />
          <h2 className="text-sm font-bold text-gray-900">Project Health</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/60 border-b border-gray-100">
                <th className="text-left py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-gray-400">Project</th>
                <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Progress</th>
                <th className="text-right py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-gray-400">Report Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {projects.map(p => {
                const prog = p.progress || 0;
                const s = (p.status || "").toLowerCase();
                const isComplete = s.includes("complet") || s === "done";
                const tok = encodeURIComponent(getToken());
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5 px-6 text-sm font-medium text-gray-800">{p.name}</td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${
                        isComplete ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        s.includes("hold") ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>{p.status || "Active"}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : prog >= 50 ? "bg-indigo-500" : "bg-amber-400"}`} style={{ width: `${prog}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-500 w-8">{prog}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isManager && (
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 transition-colors">
                            <Upload size={12} />
                            {uploadingProjectId === p.id ? "Uploading..." : "Upload Report"}
                            <input
                              type="file"
                              accept=".pdf,.docx,.txt,.csv,.xlsx,.png,.jpg"
                              onChange={e => handleReportUpload(p, e)}
                              disabled={uploadingProjectId === p.id}
                              className="hidden"
                            />
                          </label>
                        )}
                        <a
                          href={`${API_BASE}/reports/project/${p.id}/download/pdf?token=${tok}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Download PDF Report"
                        >
                          <Download size={12} /> PDF
                        </a>
                        <a
                          href={`${API_BASE}/reports/project/${p.id}/download/word?token=${tok}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Download Word Report"
                        >
                          <FileText size={12} /> Word
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {projects.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-gray-400 text-sm">No project data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
