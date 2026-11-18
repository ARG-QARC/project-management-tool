"use client";

import React, { useEffect, useState } from "react";
import {
  Plus, Search, FolderKanban, X, Calendar, AlertCircle,
  MoreHorizontal, Clock, ArrowUpRight, LayoutGrid, List,
  ImageOff, Sparkles, RefreshCw, Layers, UserCheck, User,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProgramsView from "@/app/Components/ProgramsView";
import { useProgram } from "@/context/ProgramContext";
import { API_BASE, getAuthHeaders } from "@/lib/api";

type Project = {
  id: string; name: string; domain?: string; status?: string;
  priority?: string; start_date?: string; deadline?: string;
  progress?: number; manager_name?: string; about_description?: string;
  program_id?: string;
};

// ─── Modern Project Cover (Clean branded gradients) ─────────────────────────
const COVER_THEMES = [
  { from: "#4f46e5", to: "#7c3aed" }, { from: "#0891b2", to: "#0e7490" },
  { from: "#059669", to: "#047857" }, { from: "#dc2626", to: "#b91c1c" },
  { from: "#d97706", to: "#b45309" }, { from: "#7c3aed", to: "#6d28d9" },
  { from: "#db2777", to: "#be185d" }, { from: "#2563eb", to: "#1d4ed8" },
];

function getTheme(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COVER_THEMES[Math.abs(h) % COVER_THEMES.length];
}

function ProjectCover({ project, className = "" }: { project: Project; className?: string }) {
  const t = getTheme(project.name);
  const initials = project.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center select-none ${className}`}
      style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
    >
      {/* Subtle geometric dot pattern */}
      <div className="absolute inset-0 opacity-15">
        <svg width="100%" height="100%">
          <pattern id={`p-${project.name}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1.8" fill="white" />
          </pattern>
          <rect width="100%" height="100%" fill={`url(#p-${project.name})`} />
        </svg>
      </div>

      {/* Decorative subtle ambient light accents */}
      <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
      <div className="absolute -left-8 -bottom-8 w-28 h-28 rounded-full bg-black/10 blur-xl pointer-events-none" />

      {/* Initials badge */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
        <span className="text-white/90 text-2xl font-black tracking-tight drop-shadow-sm">{initials}</span>
        {project.domain && (
          <span className="text-[10px] font-semibold text-white/70 uppercase tracking-widest mt-0.5 max-w-[140px] truncate">
            {project.domain}
          </span>
        )}
      </div>

      {/* Subtle bottom gradient shadow */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(d?: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function statusStyle(s?: string) {
  const l = (s || "").toLowerCase();
  if (l.includes("complet") || l === "done") return { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (l.includes("hold") || l.includes("pause")) return { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" };
  if (l.includes("risk") || l.includes("block")) return { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-200" };
  return { dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" };
}

function priorityDot(p?: string) {
  if ((p || "").toLowerCase() === "high") return "bg-rose-500";
  if ((p || "").toLowerCase() === "low") return "bg-slate-400";
  return "bg-amber-400";
}

export default function Projects() {
  const router = useRouter();
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const isManager =
    role.includes("manager") ||
    role.includes("administrator") ||
    role.includes("admin") ||
    role.includes("lead");
  const { selectedProgram, getProjectProgram, programs } = useProgram();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeMainTab, setActiveMainTab] = useState<"projects" | "programs">("projects");
  const [previewProject, setPreviewProject] = useState<{ id: string; name: string; domain?: string } | null>(null);
  const [form, setForm] = useState({
    name: "", domain: "", aboutTitle: "", aboutDescription: "",
    startDate: "", startTime: "09:00", deadline: "", deadlineTime: "17:00", priority: "Medium", programId: "",
  });

  // Sync default programId in form when selectedProgram changes
  useEffect(() => {
    setForm(prev => ({ ...prev, programId: selectedProgram?.id || "" }));
  }, [selectedProgram?.id]);

  // Assign Project Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [projectToAssign, setProjectToAssign] = useState<Project | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchAvailableMembers = async () => {
    try {
      const res = await fetch(`${API_BASE}/teams/members`, { headers: getAuthHeaders() }).catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        const list = Array.isArray(d) ? d : (d.members || d.data || []);
        if (list.length > 0) {
          setAvailableMembers(list);
          return;
        }
      }
      const fallback = await fetch(`${API_BASE}/programs/assignable-users`, { headers: getAuthHeaders() }).catch(() => null);
      if (fallback?.ok) {
        const fd = await fallback.json();
        setAvailableMembers(fd.users || []);
      }
    } catch (e) {
      console.error("fetchAvailableMembers error:", e);
    }
  };

  const handleAssignProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToAssign || !selectedMemberId) return;
    setAssigning(true);
    try {
      const res = await fetch(`${API_BASE}/projects/${projectToAssign.id}/assign`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: selectedMemberId, managerId: selectedMemberId }),
      });
      if (res.ok) {
        setAssignModalOpen(false);
        setProjectToAssign(null);
        setSelectedMemberId("");
        fetchProjects();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.message || "Failed to assign project");
      }
    } catch (err: any) {
      alert(err.message || "Failed to assign project");
    } finally {
      setAssigning(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/projects`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || data.data || []);
      }
    } catch (e) {
      console.error("fetchProjects error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchAvailableMembers();
  }, []);

  // Update preview as user types
  useEffect(() => {
    if (form.name.length > 2) {
      setPreviewProject({ id: "preview", name: form.name, domain: form.domain || undefined });
    } else {
      setPreviewProject(null);
    }
  }, [form.name, form.domain]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const targetProgramId = form.programId || selectedProgram?.id || null;
      const res = await fetch(`${API_BASE}/projects`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...form,
          programId: targetProgramId,
          program_id: targetProgramId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create project");
      setIsModalOpen(false);
      setForm({
        name: "", domain: "", aboutTitle: "", aboutDescription: "",
        startDate: "", startTime: "09:00", deadline: "", deadlineTime: "17:00", priority: "Medium",
        programId: selectedProgram?.id || "",
      });
      fetchProjects();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const filtered = projects.filter(p => {
    const ok = p.name.toLowerCase().includes(search.toLowerCase());
    const s = (p.status || "").toLowerCase();

    // Program scope filter
    if (selectedProgram) {
      const prog = getProjectProgram(p);
      if (prog.id !== selectedProgram.id) return false;
    }

    if (statusFilter === "all") return ok;
    if (statusFilter === "active") return ok && !["completed", "done", "on hold"].includes(s);
    if (statusFilter === "completed") return ok && (s.includes("complet") || s === "done");
    if (statusFilter === "on hold") return ok && s.includes("hold");
    return ok;
  });

  const scopedProjects = selectedProgram
    ? projects.filter(p => getProjectProgram(p).id === selectedProgram.id)
    : projects;

  const counts = {
    all: scopedProjects.length,
    active: scopedProjects.filter(p => !["completed", "done", "on hold"].includes((p.status || "").toLowerCase())).length,
    completed: scopedProjects.filter(p => ["completed", "done"].includes((p.status || "").toLowerCase())).length,
    "on hold": scopedProjects.filter(p => (p.status || "").toLowerCase().includes("hold")).length,
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* ── Hierarchy Navigation / Tab Switcher ── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveMainTab("projects")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeMainTab === "projects"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FolderKanban size={14} className={activeMainTab === "projects" ? "text-indigo-600" : ""} />
            Projects View ({scopedProjects.length})
          </button>
          <button
            onClick={() => setActiveMainTab("programs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeMainTab === "programs"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers size={14} className={activeMainTab === "programs" ? "text-indigo-600" : ""} />
            Teams & Programs {isManager ? "(Manager Hub)" : "(QARC)"}
          </button>
        </div>

        {isManager && activeMainTab === "projects" && (
          <button
            onClick={() => {
              setForm(prev => ({ ...prev, programId: selectedProgram?.id || prev.programId || "" }));
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-xs shadow-sm shadow-indigo-200 transition-all cursor-pointer"
          >
            <Plus size={15} /> New Project
          </button>
        )}
      </div>

      {/* ── CONDITIONAL RENDER: PROGRAMS / TEAMS VIEW ── */}
      {activeMainTab === "programs" ? (
        <ProgramsView onSwitchToProjects={() => setActiveMainTab("projects")} />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-1">
                {selectedProgram ? selectedProgram.name : "Portfolio"}
              </p>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Active Projects</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[13px] text-gray-500">
                  {scopedProjects.length} projects in {selectedProgram ? selectedProgram.name : "workspace"}
                </p>
                <div className="flex items-center gap-1 text-[11px] text-indigo-500 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                  <Sparkles size={10} /> AI covers
                </div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all shadow-sm" />
        </div>
        <div className="flex gap-2 flex-1 flex-wrap items-center">
          {(["all", "active", "completed", "on hold"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all capitalize ${statusFilter === s ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300"}`}>
              {s} <span className="opacity-60 ml-0.5">({counts[s]})</span>
            </button>
          ))}
          <div className="ml-auto flex items-center bg-white border border-gray-200 p-1 rounded-xl shadow-sm">
            <button onClick={() => setViewMode("cards")}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${viewMode === "cards" ? "bg-indigo-600 text-white" : "text-gray-500"}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode("table")}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${viewMode === "table" ? "bg-indigo-600 text-white" : "text-gray-500"}`}>
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── CARD VIEW ── */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {filtered.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FolderKanban size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-600 text-lg">No projects found</p>
            </div>
          ) : filtered.map(p => {
            const st = statusStyle(p.status);
            const prog = p.progress || 0;
            const days = daysUntil(p.deadline);
            const isOverdue = days !== null && days < 0;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="group block">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-200 overflow-hidden">
                  {/* Project Branded Cover */}
                  <ProjectCover project={p} className="h-44 w-full" />

                  {/* Card body */}
                  <div className="p-5">
                    {/* Parent Program Tag */}
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md">
                        <Layers size={10} />
                        {getProjectProgram(p).name}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-bold text-gray-900 group-hover:text-indigo-700 transition-colors line-clamp-1">{p.name}</h3>
                        <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{p.domain || "General"}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${st.badge}`}>{p.status || "Active"}</span>
                      </div>
                    </div>

                    {p.about_description && (
                      <p className="text-[12px] text-gray-500 line-clamp-2 mb-4 leading-relaxed">{p.about_description}</p>
                    )}

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold text-gray-500">Progress</span>
                        <span className="text-[12px] font-bold text-gray-800">{prog}%</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${prog}%`, background: prog >= 100 ? "#10b981" : prog >= 60 ? "#6366f1" : prog >= 30 ? "#f59e0b" : "#ef4444" }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${priorityDot(p.priority)}`} />
                        <span className="text-[11px] font-semibold text-gray-500">{p.priority || "Medium"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isManager && (p.status === "Unassigned" || !p.manager_name) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setProjectToAssign(p);
                              setSelectedMemberId("");
                              setAssignModalOpen(true);
                            }}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                          >
                            <UserCheck size={12} /> Assign
                          </button>
                        )}
                        {days !== null ? (
                          <span className={`text-[11px] font-semibold flex items-center gap-1 ${isOverdue ? "text-rose-600" : days <= 7 ? "text-amber-600" : "text-gray-400"}`}>
                            <Clock size={10} />
                            {isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`}
                          </span>
                        ) : <span className="text-[11px] text-gray-300">No deadline</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === "table" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Project</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 hidden md:table-cell">Priority</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Progress</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Deadline</th>
                  <th className="py-3 px-4 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-400 text-sm">No projects found.</td></tr>
                ) : filtered.map(p => {
                  const st = statusStyle(p.status);
                  const prog = p.progress || 0;
                  const days = daysUntil(p.deadline);
                  const isOverdue = days !== null && days < 0;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/60 transition-colors group">
                      <td className="py-3 px-5">
                        <Link href={`/projects/${p.id}`} className="flex items-center gap-3">
                          {/* Mini cover thumbnail */}
                          <div className="w-12 h-8 rounded-lg overflow-hidden flex-shrink-0">
                            <ProjectCover project={p} className="w-full h-full" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">{p.name}</p>
                            {p.domain && <p className="text-[11px] text-gray-400">{p.domain}</p>}
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${st.badge}`}>{p.status || "Active"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${priorityDot(p.priority)}`} />
                          <span className="text-xs text-gray-600 font-medium">{p.priority || "Medium"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${prog}%`, background: prog >= 100 ? "#10b981" : prog >= 50 ? "#6366f1" : "#f59e0b" }} />
                          </div>
                          <span className="text-xs font-bold text-gray-600 w-8">{prog}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        {days !== null ? (
                          <span className={`text-xs font-semibold ${isOverdue ? "text-rose-600" : days <= 7 ? "text-amber-600" : "text-gray-400"}`}>
                            {isOverdue ? `${Math.abs(days)}d overdue` : `${days}d left`}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {isManager && (p.status === "Unassigned" || !p.manager_name) && (
                            <button
                              type="button"
                              onClick={() => {
                                setProjectToAssign(p);
                                setSelectedMemberId("");
                                setAssignModalOpen(true);
                              }}
                              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer"
                            >
                              <UserCheck size={11} /> Assign
                            </button>
                          )}
                          <Link href={`/projects/${p.id}`}
                            className="w-7 h-7 rounded-lg hover:bg-indigo-50 flex items-center justify-center text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">
                            <ArrowUpRight size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* ── CREATE MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900">New Project</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Sparkles size={11} className="text-indigo-500" />
                  <p className="text-xs text-indigo-500 font-semibold">AI cover auto-generated from name</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 space-y-5">
              {error && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-sm flex items-start gap-2">
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Project Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Mobile App Redesign"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
              </div>

              {programs.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Program / Initiative</label>
                  <select
                    value={form.programId || selectedProgram?.id || ""}
                    onChange={e => setForm({ ...form, programId: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all bg-white"
                  >
                    <option value="">Select Program...</option>
                    {programs.map(prog => (
                      <option key={prog.id} value={prog.id}>
                        {prog.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Live Cover Preview */}
              {previewProject && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Project Cover Preview</label>
                  </div>
                  <div className="rounded-xl overflow-hidden h-32 border border-gray-100 shadow-sm">
                    <ProjectCover project={previewProject} className="w-full h-full" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">Cover style is generated dynamically from your project theme and initials.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Domain</label>
                  <input value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}
                    placeholder="e.g. Engineering"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all bg-white">
                    <option>Low</option><option>Medium</option><option>High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Start Date *</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input required type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Start Time *</label>
                  <div className="relative">
                    <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input required type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Deadline Date *</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input required type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Deadline Time *</label>
                  <div className="relative">
                    <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input required type="time" value={form.deadlineTime} onChange={e => setForm({ ...form, deadlineTime: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Description</label>
                <textarea rows={3} value={form.aboutDescription} onChange={e => setForm({ ...form, aboutDescription: e.target.value })}
                  placeholder="What is this project about?"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2">
                  {saving ? "Creating…" : <><Sparkles size={14} /> Create Project</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ASSIGN PROJECT MODAL ── */}
      {assignModalOpen && projectToAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Assign Project Lead / Member</h3>
                <p className="text-xs text-gray-500 mt-0.5">Delegate deliverable ownership</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssignModalOpen(false);
                  setProjectToAssign(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignProject} className="p-6 space-y-4">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white font-black text-sm flex items-center justify-center flex-shrink-0">
                  {projectToAssign.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 truncate">{projectToAssign.name}</h4>
                  <p className="text-xs text-indigo-700 font-medium">{projectToAssign.domain || "Deliverable"}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                  Assign To Team Member *
                </label>
                <select
                  value={selectedMemberId}
                  onChange={e => setSelectedMemberId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  required
                >
                  <option value="">Choose a member...</option>
                  {availableMembers.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.role || m.system_role || "Member"})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Assigning a member will transition project status from Unassigned to In Progress.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignModalOpen(false);
                    setProjectToAssign(null);
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedMemberId}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
                >
                  {assigning ? "Assigning..." : <><UserCheck size={14} /> Confirm Assignment</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
