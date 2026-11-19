"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart3, TrendingUp, CheckCircle2, AlertCircle, Clock,
  FolderKanban, ShieldCheck, Upload, FileText, Download,
  Users, User, Search, Award
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE } from "@/lib/api";

type Project = {
  id: string;
  name: string;
  domain?: string;
  status?: string;
  progress?: number;
  manager_name?: string;
  total_tasks?: number;
  completed_tasks?: number;
  report_id?: string;
  report_title?: string;
};

type Task = {
  id: string;
  status?: string;
  due_date?: string;
  assignee_id?: string;
  assignee_name?: string;
};

type MemberKpi = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  job_title?: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  on_time_rate: number;
  kpi_score: number;
};

function MetricBox({ label, value, sub, color }: { label: string; value: number | string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className={`text-sm font-semibold mt-1 ${color}`}>{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
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

  const [reportTab, setReportTab] = useState<"projects" | "individuals">("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<MemberKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploadingProjectId, setUploadingProjectId] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const getToken = () =>
    (typeof window !== "undefined" && (localStorage.getItem("token") || localStorage.getItem("accessToken"))) || "";

  const handleDownloadFile = async (url: string, fallbackFilename: string, key: string) => {
    try {
      setDownloadingKey(key);
      const token = getToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to generate report");
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fallbackFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(err.message || "Could not download report.");
    } finally {
      setDownloadingKey(null);
    }
  };

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
      const token = getToken();
      if (!token) { router.push("/login"); return; }
      const headers: HeadersInit = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      try {
        const [projRes, allTasksRes, myTasksRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/projects`, { headers }).catch(() => null),
          isManager ? fetch(`${API_BASE}/tasks`, { headers }).catch(() => null) : Promise.resolve(null),
          fetch(`${API_BASE}/tasks/my/tasks`, { headers }).catch(() => null),
          fetch(`${API_BASE}/users`, { headers }).catch(() => null),
        ]);

        let allProjects: Project[] = [];
        if (projRes?.ok) {
          const projData = await projRes.json();
          allProjects = projData.projects || projData.data || [];
          setProjects(allProjects);
        }

        let loadedTasks: Task[] = [];
        if (allTasksRes?.ok) {
          const td = await allTasksRes.json();
          loadedTasks = td.tasks || td.data || [];
        } else if (myTasksRes?.ok) {
          const d = await myTasksRes.json();
          loadedTasks = d.tasks || d.data || [];
        }
        setTasks(loadedTasks);

        if (usersRes?.ok) {
          const ud = await usersRes.json();
          const rawUsers = ud.users || ud.data || [];
          setMembers(
            rawUsers.map((u: any) => ({
              id: u.id,
              full_name: u.full_name,
              email: u.email,
              role: u.role,
              job_title: u.job_title,
              total_tasks: u.total_tasks ?? u.taskStats?.total ?? 0,
              completed_tasks: u.completed_tasks ?? u.taskStats?.completed ?? 0,
              in_progress_tasks: u.in_progress_tasks ?? u.taskStats?.in_progress ?? 0,
              overdue_tasks: u.overdue_tasks ?? u.taskStats?.overdue ?? 0,
              completion_rate: u.completion_rate ?? u.taskStats?.completion_rate ?? 0,
              on_time_rate: u.on_time_rate ?? u.taskStats?.on_time_rate ?? 100,
              kpi_score: u.kpi_score ?? u.taskStats?.kpi_score ?? 0,
            }))
          );
        } else if (user) {
          const myTotal = loadedTasks.length;
          const myDone = loadedTasks.filter(t => t.status === "Completed" || t.status === "Done").length;
          const myInProg = loadedTasks.filter(t => t.status === "In Progress").length;
          const myOverdue = loadedTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "Completed" && t.status !== "Done").length;
          const cRate = myTotal > 0 ? Math.round((myDone / myTotal) * 100) : 0;
          const oRate = myTotal > 0 ? Math.round(((myTotal - myOverdue) / myTotal) * 100) : 100;
          setMembers([
            {
              id: user.id,
              full_name: user.full_name || user.name || "Me",
              email: user.email || "",
              role: user.role || "Member",
              total_tasks: myTotal,
              completed_tasks: myDone,
              in_progress_tasks: myInProg,
              overdue_tasks: myOverdue,
              completion_rate: cRate,
              on_time_rate: oRate,
              kpi_score: myTotal > 0 ? Math.round(cRate * 0.7 + oRate * 0.3) : 0,
            },
          ]);
        }
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

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.domain || "").toLowerCase().includes(q) ||
      (p.manager_name || "").toLowerCase().includes(q)
    );
  }, [projects, search]);

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return members;
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  }, [members, search]);

  if (loading) return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-1">Insights & Exports</p>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports Center</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Download comprehensive project-basis reports and individual member KPI reports in PDF or Word.
          </p>
        </div>

        {/* Tab Switcher: Project-Basis vs Individual-Basis */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setReportTab("projects")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              reportTab === "projects"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FolderKanban size={14} />
            Project-Basis Reports ({projects.length})
          </button>
          <button
            onClick={() => setReportTab("individuals")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              reportTab === "individuals"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users size={14} />
            Individual-Basis Reports ({members.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBox label="Tasks Completed" value={done} sub={`${rate}% completion rate`} color="text-emerald-600" />
        <MetricBox label="In Progress" value={inProgress} sub="currently active" color="text-blue-600" />
        <MetricBox label="Overdue Tasks" value={overdue} sub={overdue > 0 ? "needs attention" : "all on track"} color={overdue > 0 ? "text-rose-600" : "text-emerald-600"} />
        <MetricBox label="Projects Done" value={`${completed}/${projects.length}`} sub={`avg ${avgProgress}% progress`} color="text-violet-600" />
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={reportTab === "projects" ? "Search project reports..." : "Search member reports..."}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 shadow-sm"
        />
      </div>

      {/* ════════════════ TAB 1: PROJECT-BASIS REPORTS ════════════════ */}
      {reportTab === "projects" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban size={15} className="text-indigo-500" />
              <h2 className="text-sm font-bold text-gray-900">Project-Basis Reports</h2>
            </div>
            <span className="text-xs text-gray-400 font-medium">Download project summary & full task breakdown</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="text-left py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-gray-400">Project</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Assigned to</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Progress</th>
                  <th className="text-right py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-gray-400">Report Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProjects.map(p => {
                  const prog = p.progress || 0;
                  const s = (p.status || "").toLowerCase();
                  const isComplete = s.includes("complet") || s === "done";
                  const safeName = p.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
                  const pdfKey = `proj-pdf-${p.id}`;
                  const wordKey = `proj-word-${p.id}`;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-6">
                        <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                        <p className="text-[11px] text-gray-400">{p.domain || "General"}</p>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-gray-700">
                        {p.manager_name || <span className="text-amber-600 font-semibold">Unassigned</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${
                          isComplete ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          s.includes("hold") ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>{p.status || "Active"}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : prog >= 50 ? "bg-indigo-500" : "bg-amber-400"}`} style={{ width: `${prog}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-600">{prog}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isManager && (
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 transition-colors">
                              <Upload size={12} />
                              {uploadingProjectId === p.id ? "Uploading..." : "Upload Notes"}
                              <input
                                type="file"
                                accept=".pdf,.docx,.txt,.csv,.xlsx,.png,.jpg"
                                onChange={e => handleReportUpload(p, e)}
                                disabled={uploadingProjectId === p.id}
                                className="hidden"
                              />
                            </label>
                          )}
                          <button
                            type="button"
                            disabled={downloadingKey === pdfKey}
                            onClick={() =>
                              handleDownloadFile(
                                `${API_BASE}/reports/project/${p.id}/download/pdf`,
                                `${safeName}_project_report.pdf`,
                                pdfKey
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                            title="Download Project PDF Report"
                          >
                            <Download size={12} /> {downloadingKey === pdfKey ? "Generating..." : "PDF"}
                          </button>
                          <button
                            type="button"
                            disabled={downloadingKey === wordKey}
                            onClick={() =>
                              handleDownloadFile(
                                `${API_BASE}/reports/project/${p.id}/download/word`,
                                `${safeName}_project_report.docx`,
                                wordKey
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Download Project Word Report"
                          >
                            <FileText size={12} /> {downloadingKey === wordKey ? "Generating..." : "Word"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProjects.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-gray-400 text-sm">No projects found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════ TAB 2: INDIVIDUAL-BASIS REPORTS ════════════════ */}
      {reportTab === "individuals" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-indigo-500" />
              <h2 className="text-sm font-bold text-gray-900">Individual Member Performance & Task Reports</h2>
            </div>
            <span className="text-xs text-gray-400 font-medium">Download member-specific KPI, tasks & daily updates report</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="text-left py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-gray-400">Team Member</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Role</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Tasks (Done / Total)</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Completion Rate</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">KPI Score</th>
                  <th className="text-right py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-gray-400">Download Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMembers.map(m => {
                  const safeName = (m.full_name || "member").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
                  const pdfKey = `usr-pdf-${m.id}`;
                  const wordKey = `usr-word-${m.id}`;
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {getInitials(m.full_name)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{m.full_name}</p>
                            <p className="text-[11px] text-gray-400">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-gray-700">
                        <span className="text-emerald-600 font-bold">{m.completed_tasks}</span> / {m.total_tasks}
                        {m.overdue_tasks > 0 && (
                          <span className="ml-2 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            {m.overdue_tasks} overdue
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${m.completion_rate >= 75 ? "bg-emerald-500" : m.completion_rate >= 40 ? "bg-indigo-500" : "bg-amber-400"}`}
                              style={{ width: `${m.completion_rate}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-700">{m.completion_rate}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          m.kpi_score >= 80
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : m.kpi_score >= 50
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          <Award size={12} /> {m.kpi_score} / 100
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={downloadingKey === pdfKey}
                            onClick={() =>
                              handleDownloadFile(
                                `${API_BASE}/reports/user/${m.id}/download/pdf`,
                                `${safeName}_individual_report.pdf`,
                                pdfKey
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                            title="Download Individual PDF Report"
                          >
                            <Download size={12} /> {downloadingKey === pdfKey ? "Generating..." : "PDF"}
                          </button>
                          <button
                            type="button"
                            disabled={downloadingKey === wordKey}
                            onClick={() =>
                              handleDownloadFile(
                                `${API_BASE}/reports/user/${m.id}/download/word`,
                                `${safeName}_individual_report.docx`,
                                wordKey
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Download Individual Word Report"
                          >
                            <FileText size={12} /> {downloadingKey === wordKey ? "Generating..." : "Word"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400 text-sm">No members found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
