"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, TrendingUp, AlertCircle, CheckCircle2,
  Clock, Users, FolderKanban, Zap, MoreHorizontal,
  ChevronRight, Circle, Activity, Layers, ShieldCheck,
  Award, Briefcase, FileCheck, Play, Send, Sparkles, Filter,
  User,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProgram } from "@/context/ProgramContext";
import { API_BASE } from "@/lib/api";

type Project = {
  id: string; name: string; status?: string; progress?: number;
  deadline?: string; priority?: string; domain?: string; manager_name?: string;
};
type Task = {
  id: string; name?: string; title?: string; status?: string;
  due_date?: string; project_id?: string; project_name?: string;
  assignee_id?: string; assignee_name?: string; priority?: string;
  updated_at?: string; created_at?: string;
};
type TeamMember = { id: string; full_name: string; role: string };

// â”€â”€â”€ SVG Donut Chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DonutChart({
  segments,
  size = 160,
  stroke = 22,
  label,
  sublabel,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  stroke?: number;
  label: string;
  sublabel: string;
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const len = (seg.value / total) * circumference;
    const arc = { ...seg, dashOffset: circumference - len, strokeDashoffset: offset };
    offset -= len;
    return arc;
  });

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {/* Segments */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={`${circumference - arc.dashOffset} ${arc.dashOffset}`}
            strokeDashoffset={arc.strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        ))}
      </svg>
      <div className="absolute text-center pointer-events-none">
        <p className="text-2xl font-bold text-gray-900 leading-none">{label}</p>
        <p className="text-[11px] text-gray-400 mt-1 font-medium">{sublabel}</p>
      </div>
    </div>
  );
}

// â”€â”€â”€ Horizontal Bar Chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function HorizBarChart({ bars }: { bars: { label: string; value: number; max: number; color: string; sub?: string }[] }) {
  return (
    <div className="space-y-3.5">
      {bars.map((b, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1.5">
            <div>
              <span className="text-[13px] font-semibold text-gray-700">{b.label}</span>
              {b.sub && <span className="text-[11px] text-gray-400 ml-2">{b.sub}</span>}
            </div>
            <span className="text-[13px] font-bold text-gray-800">{b.value}</span>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (b.value / b.max) * 100)}%`, background: b.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// â”€â”€â”€ Radial Progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RadialProgress({ pct, color, size = 48 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    </svg>
  );
}

// â”€â”€â”€ Mini sparkline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 80, h = 32;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function daysUntil(d?: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-indigo-400 to-violet-500", "from-blue-400 to-cyan-500",
  "from-emerald-400 to-teal-500", "from-rose-400 to-pink-500",
  "from-amber-400 to-orange-500", "from-violet-400 to-purple-500",
];

function avatarGrad(name: string) {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

function statusColor(s?: string) {
  const l = (s || "").toLowerCase();
  if (l.includes("complet") || l === "done") return "#10b981";
  if (l.includes("hold") || l.includes("pause")) return "#f59e0b";
  if (l.includes("risk") || l.includes("block")) return "#ef4444";
  return "#6366f1";
}

function priorityColor(p?: string) {
  if ((p || "").toLowerCase() === "high") return "#ef4444";
  if ((p || "").toLowerCase() === "low") return "#94a3b8";
  return "#f59e0b";
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedProgram, selectProgram, getProjectProgram } = useProgram();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewRoleTab, setViewRoleTab] = useState<"pm" | "member">("pm");

  // Determine user role type
  const userRole = user?.role || "";
  const isManager = useMemo(() => {
    const r = userRole.toLowerCase();
    return (
      r.includes("manager") ||
      r.includes("administrator") ||
      r.includes("admin") ||
      r.includes("lead")
    );
  }, [userRole]);

  // Set default view tab based on detected role
  useEffect(() => {
    if (isManager) {
      setViewRoleTab("pm");
    } else {
      setViewRoleTab("member");
    }
  }, [isManager]);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
      if (!token) { router.push("/login"); return; }
      const headers: HeadersInit = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      try {
        const [projRes, membersRes, myTasksRes] = await Promise.all([
          fetch(`${API_BASE}/projects`, { headers }).catch(() => null),
          fetch(`${API_BASE}/teams/members`, { headers }).catch(() => null),
          fetch(`${API_BASE}/tasks/my/tasks`, { headers }).catch(() => null),
        ]);

        let loadedProjects: Project[] = [];
        if (projRes?.ok) {
          const projData = await projRes.json();
          loadedProjects = projData.projects || projData.data || [];
          setProjects(loadedProjects);
        }

        if (membersRes?.ok) {
          const md = await membersRes.json();
          setTeamMembers(Array.isArray(md) ? md : (md.members || md.data || md.users || []));
        }

        let loadedTasks: Task[] = [];
        if (loadedProjects.length > 0) {
          const taskArrays = await Promise.all(
            loadedProjects.map(async (p) => {
              const res = await fetch(`${API_BASE}/tasks/project/${p.id}`, { headers }).catch(() => null);
              if (!res || !res.ok) return [];
              const d = await res.json();
              return (d.tasks || d.data || []).map((t: Task) => ({ ...t, project_id: p.id, project_name: p.name }));
            })
          );
          loadedTasks = taskArrays.flat();
        }

        if (myTasksRes?.ok) {
          const myData = await myTasksRes.json();
          const personal = (myData.tasks || myData.data || []).map((t: any) => ({
            ...t,
            project_id: t.project_id || t.projectId,
            project_name: t.project_name || t.project?.name || "Project",
          }));
          const existingIds = new Set(loadedTasks.map(t => t.id));
          for (const pt of personal) {
            if (!existingIds.has(pt.id)) {
              loadedTasks.push(pt);
            }
          }
        }

        setTasks(loadedTasks);
      } catch (e) {
        console.error("Dashboard data load error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  // Scope projects and tasks by selectedProgram if active
  const scopedProjects = useMemo(() => {
    if (!selectedProgram) return projects;
    return projects.filter(p => getProjectProgram(p).id === selectedProgram.id);
  }, [projects, selectedProgram, getProjectProgram]);

  const scopedTasks = useMemo(() => {
    if (!selectedProgram) return tasks;
    const scopedProjectIds = new Set(scopedProjects.map(p => p.id));
    return tasks.filter(t => t.project_id && scopedProjectIds.has(t.project_id));
  }, [tasks, scopedProjects, selectedProgram]);

  // General project manager & platform statistics
  const pmStats = useMemo(() => {
    const done = scopedTasks.filter((t) => t.status === "Completed" || t.status === "Done").length;
    const completedPendingReview = scopedTasks.filter((t) => t.status === "Completed").length;
    const inProgress = scopedTasks.filter((t) => t.status === "In Progress").length;
    const todo = scopedTasks.filter((t) => t.status === "To Do" || !t.status).length;
    const review = scopedTasks.filter((t) => t.status === "Review").length;
    const overdue = scopedTasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && !["done", "completed"].includes((t.status || "").toLowerCase())).length;
    const active = scopedProjects.filter((p) => !["completed", "done"].includes((p.status || "").toLowerCase())).length;
    const completed = scopedProjects.filter((p) => ["completed", "done"].includes((p.status || "").toLowerCase())).length;
    const rate = scopedTasks.length > 0 ? Math.round((done / scopedTasks.length) * 100) : 0;
    return { done, completedPendingReview, inProgress, todo, review, overdue, active, completed, rate };
  }, [scopedTasks, scopedProjects]);

  // Member-specific metrics & task breakdown
  const memberTasks = useMemo(() => {
    return scopedTasks.filter((t) => t.assignee_id === String(user?.id) || t.assignee_id === user?.id || (t.assignee_name && user?.full_name && t.assignee_name.toLowerCase() === user.full_name.toLowerCase()));
  }, [scopedTasks, user]);

  const memberStats = useMemo(() => {
    const total = memberTasks.length;
    const done = memberTasks.filter((t) => t.status === "Completed" || t.status === "Done").length;
    const completedPendingReview = memberTasks.filter((t) => t.status === "Completed").length;
    const inProgress = memberTasks.filter((t) => t.status === "In Progress").length;
    const todo = memberTasks.filter((t) => t.status === "To Do" || !t.status).length;
    const overdue = memberTasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && !["done", "completed"].includes((t.status || "").toLowerCase())).length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    
    // Member projects list
    const memberProjectIds = new Set(memberTasks.map(t => t.project_id));
    const memberProjects = scopedProjects.filter(p => memberProjectIds.has(p.id));

    // Next upcoming priority tasks
    const focusTasks = [...memberTasks]
      .filter(t => !["done", "completed"].includes((t.status || "").toLowerCase()))
      .sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

    return { total, done, completedPendingReview, inProgress, todo, overdue, rate, memberProjects, focusTasks };
  }, [memberTasks, scopedProjects]);

  // Pending approvals for PM (tasks with status "Completed" needing PM to mark "Done")
  const pendingApprovals = useMemo(() => {
    return scopedTasks
      .filter((t) => t.status === "Completed")
      .slice(0, 8);
  }, [scopedTasks]);

  const firstName = (user?.full_name || user?.name || "there").split(" ")[0];

  const memberWorkload = useMemo(() => {
    return teamMembers.map((m) => {
      const mt = scopedTasks.filter((t) => t.assignee_id === m.id || t.assignee_name === m.full_name);
      const done = mt.filter((t) => t.status === "Completed" || t.status === "Done").length;
      return { ...m, total: mt.length, done, rate: mt.length > 0 ? Math.round((done / mt.length) * 100) : 0 };
    }).filter(m => !selectedProgram || m.total > 0).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [teamMembers, scopedTasks, selectedProgram]);

  const upcomingDeadlines = useMemo(() => {
    return scopedProjects
      .filter((p) => p.deadline && daysUntil(p.deadline) !== null && daysUntil(p.deadline)! <= 30)
      .sort((a, b) => (daysUntil(a.deadline) ?? 99) - (daysUntil(b.deadline) ?? 99))
      .slice(0, 5);
  }, [scopedProjects]);

  const priorityBreakdown = useMemo(() => {
    const targetTasks = viewRoleTab === "member" ? memberTasks : scopedTasks;
    const high = targetTasks.filter((t) => (t.priority || "").toLowerCase() === "high").length;
    const medium = targetTasks.filter((t) => (t.priority || "").toLowerCase() === "medium").length;
    const low = targetTasks.filter((t) => (t.priority || "").toLowerCase() === "low" || !t.priority).length;
    return { high, medium, low };
  }, [viewRoleTab, memberTasks, scopedTasks]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading workspace…</p>
      </div>
    );
  }

  const maxWorkload = Math.max(...memberWorkload.map((m) => m.total), 1);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">

      {/* ── Top Role Switcher / Indicator (For Managers who also have assigned tasks) ── */}
      {isManager && (
        <div className="flex items-center justify-between bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-sm">
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-indigo-600" /> View Mode:
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              {userRole || "Project Manager"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewRoleTab("pm")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewRoleTab === "pm"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Briefcase size={13} /> {userRole.includes("Task Manager") ? "Task Manager Overview" : userRole.includes("Project") ? "Project Manager Overview" : "Manager Overview"}
            </button>
            <button
              type="button"
              onClick={() => setViewRoleTab("member")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewRoleTab === "member"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <User size={13} /> My Personal Execution ({memberTasks.length})
            </button>
          </div>
        </div>
      )}

      {/* ── Header / Program Banner ── */}
      {selectedProgram ? (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white rounded-2xl p-2.5 shadow-md border border-white/20 flex-shrink-0 flex items-center justify-center">
                <img
                  src="/arg-logo.jpg"
                  alt="Al Rahim Group Logo"
                  className="h-12 w-auto object-contain rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 border border-indigo-400/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <Layers size={12} /> Team Program Dashboard
                  </span>
                  <span className="text-xs text-slate-300 font-semibold">• {selectedProgram.domain}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {selectedProgram.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  {selectedProgram.description}
                </p>
              </div>
            </div>

            {isManager && (
              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => router.push("/programs")}
                  className="px-4 py-2 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers size={14} /> Switch Team
                </button>
                <button
                  type="button"
                  onClick={() => selectProgram("all")}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  Clear Scope (View All)
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-slate-400 font-medium">Program Deliverables</p>
              <p className="text-lg font-bold text-white mt-0.5">{scopedProjects.length} Projects</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Active Tasks</p>
              <p className="text-lg font-bold text-indigo-300 mt-0.5">{scopedTasks.length} Tasks</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Completion Index</p>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">{pmStats.rate}% Done</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Pending PM Approvals</p>
              <p className={`text-lg font-bold mt-0.5 ${pmStats.completedPendingReview > 0 ? "text-amber-400" : "text-slate-300"}`}>
                {pmStats.completedPendingReview} Tasks
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-slate-50 rounded-2xl p-2 border border-slate-200 flex-shrink-0 flex items-center justify-center">
              <img
                src="/arg-logo.jpg"
                alt="Al Rahim Group Logo"
                className="h-12 w-auto object-contain rounded-lg"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  viewRoleTab === "pm"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  {viewRoleTab === "pm" ? "Project Management Dashboard" : "Team Member Execution Dashboard"}
                </span>
                <span className="text-xs font-semibold text-slate-400">• Al Rahim Group Enterprise</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"},{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{firstName}</span>
              </h2>
              <p className="text-[13px] text-gray-500 mt-0.5">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                {viewRoleTab === "member" && ` · You have ${memberStats.focusTasks.length} active tasks assigned`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <span className="flex items-center gap-1.5 bg-slate-50 border border-gray-100 shadow-sm rounded-xl px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {viewRoleTab === "pm" 
                ? `Live · ${scopedProjects.length} projects · ${scopedTasks.length} tasks`
                : `Live · ${memberStats.memberProjects.length} contributing projects · ${memberTasks.length} assigned`}
            </span>
          </div>
        </div>
      )}

      {/* =========================================================
          VIEW 1: PROJECT MANAGER DASHBOARD
      ========================================================= */}
      {viewRoleTab === "pm" && (
        <>
          {/* ── PM Row 1: Stat Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Projects */}
            <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white overflow-hidden shadow-lg shadow-indigo-200">
              <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
              <FolderKanban size={20} className="text-indigo-200 mb-4 relative z-10" />
              <p className="text-4xl font-black relative z-10">{pmStats.active}</p>
              <p className="text-sm font-semibold text-indigo-100 mt-0.5 relative z-10">
                {selectedProgram ? "Program Deliverables" : "Managed Projects"}
              </p>
              <p className="text-xs text-indigo-200 mt-1 relative z-10">{pmStats.completed} completed</p>
            </div>

            {/* Task Completion Rate */}
            <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white overflow-hidden shadow-lg shadow-emerald-200">
              <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
              <CheckCircle2 size={20} className="text-emerald-100 mb-4 relative z-10" />
              <p className="text-4xl font-black relative z-10">{pmStats.rate}%</p>
              <p className="text-sm font-semibold text-emerald-100 mt-0.5 relative z-10">Project Completion</p>
              <p className="text-xs text-emerald-200 mt-1 relative z-10">{pmStats.done} of {scopedTasks.length} tasks verified</p>
            </div>

            {/* Awaiting PM Approval */}
            <div className={`relative rounded-2xl p-5 text-white overflow-hidden shadow-lg ${pmStats.completedPendingReview > 0 ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-200" : "bg-gradient-to-br from-slate-700 to-slate-800 shadow-slate-300"}`}>
              <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
              <FileCheck size={20} className="text-amber-100 mb-4 relative z-10" />
              <p className="text-4xl font-black relative z-10">{pmStats.completedPendingReview}</p>
              <p className="text-sm font-semibold text-white mt-0.5 relative z-10">Needs PM Sign-Off</p>
              <p className="text-xs text-amber-100 mt-1 relative z-10">Marked Completed by members</p>
            </div>

            {/* Team Members & Overdue */}
            <div className={`relative rounded-2xl p-5 text-white overflow-hidden shadow-lg ${pmStats.overdue > 0 ? "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-200" : "bg-gradient-to-br from-slate-800 to-slate-900 shadow-slate-300"}`}>
              <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
              <AlertCircle size={20} className="text-rose-200 mb-4 relative z-10" />
              <p className="text-4xl font-black relative z-10">{pmStats.overdue}</p>
              <p className="text-sm font-semibold text-white/90 mt-0.5 relative z-10">Overdue Milestones</p>
              <p className="text-xs text-rose-100 mt-1 relative z-10">
                {pmStats.overdue > 0 ? "Needs immediate realignment" : "All deliverables on track ✓"}
              </p>
            </div>
          </div>

          {/* ── PM Row 2: Pending Approvals & Task Donut & Priorities ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* PM Approval Queue */}
            <div className="bg-white rounded-2xl border border-amber-200/80 shadow-sm p-6 flex flex-col relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <FileCheck size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Pending Review Queue</h3>
                    <p className="text-[11px] text-gray-400">Members marked these Completed</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push("/tasks?status=Completed")}
                  className="text-[11px] text-amber-700 font-bold hover:text-amber-900 flex items-center gap-0.5"
                >
                  Inspect All <ChevronRight size={12} />
                </button>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[260px]">
                {pendingApprovals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                    <CheckCircle2 size={32} className="mb-2 text-emerald-400" />
                    <p className="text-xs font-semibold text-slate-600">All submissions reviewed</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">No tasks awaiting PM sign-off</p>
                  </div>
                ) : (
                  pendingApprovals.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => router.push("/tasks")}
                      className="p-3 rounded-xl border border-amber-100 bg-amber-50/40 hover:bg-amber-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition-colors truncate">
                          {t.name || t.title}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                          Review
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate max-w-[150px]">{t.assignee_name || "Assigned Member"}</span>
                        <span className="text-[10px] font-medium text-slate-500">{t.project_name}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Task Overview Donut */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <Activity size={15} className="text-indigo-500" />
                <h3 className="text-sm font-bold text-gray-900">Task Status Distribution</h3>
              </div>
              <div className="flex items-center gap-6 justify-center flex-wrap">
                <DonutChart
                  size={150}
                  stroke={20}
                  label={`${pmStats.rate}%`}
                  sublabel="Verified Done"
                  segments={[
                    { value: pmStats.done, color: "#10b981", label: "Completed" },
                    { value: pmStats.completedPendingReview, color: "#f59e0b", label: "Completed" },
                    { value: pmStats.inProgress, color: "#6366f1", label: "In Progress" },
                    { value: pmStats.todo, color: "#e2e8f0", label: "To Do" },
                  ]}
                />
                <div className="space-y-2.5">
                  {[
                    { label: "Done (Verified)", value: pmStats.done, color: "#10b981" },
                    { label: "Completed (Pending PM)", value: pmStats.completedPendingReview, color: "#f59e0b" },
                    { label: "In Progress", value: pmStats.inProgress, color: "#6366f1" },
                    { label: "To Do", value: pmStats.todo, color: "#cbd5e1" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-[11px] text-gray-600 font-medium w-28 truncate">{s.label}</span>
                      <span className="text-[12px] font-bold text-gray-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Priority Distribution */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={15} className="text-amber-500" />
                <h3 className="text-sm font-bold text-gray-900">Priority Breakdown</h3>
              </div>
              <div className="flex items-end justify-around h-32 mb-4">
                {[
                  { label: "High", value: priorityBreakdown.high, color: "#ef4444" },
                  { label: "Medium", value: priorityBreakdown.medium, color: "#f59e0b" },
                  { label: "Low", value: priorityBreakdown.low, color: "#94a3b8" },
                ].map((bar) => {
                  const maxVal = Math.max(priorityBreakdown.high, priorityBreakdown.medium, priorityBreakdown.low, 1);
                  const heightPct = (bar.value / maxVal) * 100;
                  return (
                    <div key={bar.label} className="flex flex-col items-center gap-1.5">
                      <span className="text-[12px] font-bold text-gray-800">{bar.value}</span>
                      <div className="w-10 rounded-t-xl transition-all duration-700 flex-shrink-0" style={{
                        height: `${Math.max(heightPct, 8)}px`,
                        background: `linear-gradient(to top, ${bar.color}dd, ${bar.color}88)`,
                      }} />
                      <span className="text-[11px] font-semibold text-gray-500">{bar.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Critical focus items:</span>
                <span className="font-bold text-rose-600">{priorityBreakdown.high} high priority</span>
              </div>
            </div>
          </div>

          {/* ── PM Row 3: Project Tracker ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderKanban size={16} className="text-indigo-500" />
                <h3 className="text-base font-bold text-gray-900">
                  Deliverables & Project Tracker {selectedProgram && <span className="text-xs font-normal text-indigo-600">({selectedProgram.name})</span>}
                </h3>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">{scopedProjects.length}</span>
              </div>
              <button onClick={() => router.push("/projects")} className="text-[12px] text-indigo-600 font-semibold hover:text-indigo-800 transition-colors flex items-center gap-1">
                Manage all projects <ChevronRight size={13} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {scopedProjects.map((p, i) => {
                const projectTasks = tasks.filter((t) => t.project_id === p.id);
                const doneTasks = projectTasks.filter((t) => t.status === "Completed" || t.status === "Done").length;
                const prog = projectTasks.length > 0 
                  ? Math.round((doneTasks / projectTasks.length) * 100) 
                  : (["unassigned", "not started"].includes((p.status || "").toLowerCase()) ? 0 : (p.progress || 0));
                const days = daysUntil(p.deadline);
                const isOverdue = days !== null && days < 0 && !["completed", "done"].includes((p.status || "").toLowerCase());
                const sc = statusColor(p.status);
                const CARD_GRADIENTS = [
                  "from-indigo-500/10 to-violet-500/5",
                  "from-blue-500/10 to-cyan-500/5",
                  "from-emerald-500/10 to-teal-500/5",
                  "from-rose-500/10 to-pink-500/5",
                  "from-amber-500/10 to-orange-500/5",
                  "from-violet-500/10 to-purple-500/5",
                ];
                return (
                  <div
                    key={p.id}
                    className={`bg-gradient-to-br ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]} border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden`}
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <div className="absolute top-3 right-3">
                      <RadialProgress pct={prog} color={sc} size={44} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] font-black text-gray-700" style={{ fontSize: "9px" }}>{prog}%</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 mb-4 pr-12">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${sc}22` }}>
                        <FolderKanban size={16} style={{ color: sc }} />
                      </div>
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded mb-0.5">
                          <Layers size={9} /> {getProjectProgram(p).name}
                        </span>
                        <h4 className="text-[13px] font-bold text-gray-900 group-hover:text-indigo-700 transition-colors line-clamp-1">{p.name}</h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">{p.domain || "General"}</p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${prog}%`, background: `linear-gradient(to right, ${sc}cc, ${sc})` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
                        <span>{doneTasks}/{projectTasks.length} tasks</span>
                        {days !== null && (
                          <span className={`flex items-center gap-1 ${isOverdue ? "text-rose-500" : days <= 7 ? "text-amber-600" : "text-gray-400"}`}>
                            <Clock size={10} />
                            {isOverdue ? `${Math.abs(days)}d late` : `${days}d left`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: sc }} />
                        <span className="text-[10px] font-semibold" style={{ color: sc }}>{p.status || "Active"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── PM Row 4: Team Workload + Deadlines ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Team Workload */}
            {memberWorkload.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Users size={15} className="text-violet-500" />
                  <h3 className="text-sm font-bold text-gray-900">Team Workload Distribution</h3>
                </div>
                <div className="space-y-4">
                  {memberWorkload.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatarGrad(m.full_name)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                        {getInitials(m.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-semibold text-gray-700 truncate max-w-[140px]">{m.full_name}</span>
                          <span className="text-[11px] font-bold text-gray-500 ml-2 flex-shrink-0">{m.done}/{m.total}</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(m.total / maxWorkload) * 100}%`,
                              background: m.total / maxWorkload > 0.8
                                ? "linear-gradient(to right, #ef4444, #dc2626)"
                                : m.total / maxWorkload > 0.5
                                ? "linear-gradient(to right, #f59e0b, #d97706)"
                                : "linear-gradient(to right, #6366f1, #8b5cf6)",
                            }}
                          />
                        </div>
                      </div>
                      <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                        m.rate >= 80 ? "bg-emerald-50 text-emerald-700" :
                        m.rate >= 50 ? "bg-indigo-50 text-indigo-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {m.rate}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Deadlines */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <Clock size={15} className="text-rose-500" />
                <h3 className="text-sm font-bold text-gray-900">Upcoming Project Deadlines</h3>
              </div>
              {upcomingDeadlines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                  <Clock size={28} className="mb-2" />
                  <p className="text-xs font-medium text-gray-400">No upcoming deadlines</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingDeadlines.map((p) => {
                    const days = daysUntil(p.deadline);
                    const isLate = days !== null && days < 0 && !["completed", "done"].includes((p.status || "").toLowerCase());
                    const projectTasks = tasks.filter((t) => t.project_id === p.id);
                    const doneTasks = projectTasks.filter((t) => t.status === "Completed" || t.status === "Done").length;
                    const prog = projectTasks.length > 0 
                      ? Math.round((doneTasks / projectTasks.length) * 100) 
                      : (["unassigned", "not started"].includes((p.status || "").toLowerCase()) ? 0 : (p.progress || 0));
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className="relative flex-shrink-0">
                          <RadialProgress
                            pct={prog}
                            color={isLate ? "#ef4444" : days !== null && days <= 7 ? "#f59e0b" : "#6366f1"}
                            size={40}
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[8px] font-black text-gray-700">{prog}%</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-gray-800 truncate">{p.name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{p.domain || "Project"}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-[12px] font-bold ${isLate ? "text-rose-600" : days !== null && days <= 7 ? "text-amber-600" : "text-gray-500"}`}>
                            {isLate ? `${Math.abs(days!)}d late` : days === 0 ? "Today" : `${days}d`}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {p.deadline ? new Date(p.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* =========================================================
          VIEW 2: MEMBER DASHBOARD (Personal Execution)
      ========================================================= */}
      {viewRoleTab === "member" && (
        <>
          {/* ── Member Row 1: Personal Execution Stat Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Assigned */}
            <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white overflow-hidden shadow-lg shadow-indigo-200">
              <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
              <Briefcase size={20} className="text-indigo-200 mb-4 relative z-10" />
              <p className="text-4xl font-black relative z-10">{memberStats.total}</p>
              <p className="text-sm font-semibold text-indigo-100 mt-0.5 relative z-10">My Assigned Tasks</p>
              <p className="text-xs text-indigo-200 mt-1 relative z-10">{memberStats.inProgress} currently in progress</p>
            </div>

            {/* My Completion Rate */}
            <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white overflow-hidden shadow-lg shadow-emerald-200">
              <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
              <CheckCircle2 size={20} className="text-emerald-100 mb-4 relative z-10" />
              <p className="text-4xl font-black relative z-10">{memberStats.rate}%</p>
              <p className="text-sm font-semibold text-emerald-100 mt-0.5 relative z-10">My Completion Rate</p>
              <p className="text-xs text-emerald-200 mt-1 relative z-10">{memberStats.done} of {memberStats.total} verified</p>
            </div>

            {/* In Review (Marked Completed, awaiting PM Done) */}
            <div className="relative bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white overflow-hidden shadow-lg shadow-amber-200">
              <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
              <Clock size={20} className="text-amber-100 mb-4 relative z-10" />
              <p className="text-4xl font-black relative z-10">{memberStats.completedPendingReview}</p>
              <p className="text-sm font-semibold text-amber-100 mt-0.5 relative z-10">In PM Review</p>
              <p className="text-xs text-amber-200 mt-1 relative z-10">Waiting for manager approval</p>
            </div>

            {/* Overdue */}
            <div className={`relative rounded-2xl p-5 text-white overflow-hidden shadow-lg ${memberStats.overdue > 0 ? "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-200" : "bg-gradient-to-br from-slate-700 to-slate-800 shadow-slate-300"}`}>
              <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
              <AlertCircle size={20} className="text-rose-200 mb-4 relative z-10" />
              <p className="text-4xl font-black relative z-10">{memberStats.overdue}</p>
              <p className="text-sm font-semibold text-white/90 mt-0.5 relative z-10">Overdue Tasks</p>
              <p className="text-xs text-rose-100 mt-1 relative z-10">
                {memberStats.overdue > 0 ? "Urgent attention required" : "All deliverables on schedule ✓"}
              </p>
            </div>
          </div>

          {/* ── Member Row 2: Focus Queue & Status Breakdown ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* My Focus Queue (Sorted by Urgency) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">My Priority Focus Queue</h3>
                    <p className="text-[11px] text-gray-400">Tasks assigned directly to you, ordered by due date</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push("/tasks")}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  View Kanban Board <ChevronRight size={13} />
                </button>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[360px]">
                {memberStats.focusTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                    <CheckCircle2 size={36} className="mb-2 text-emerald-400" />
                    <p className="text-sm font-bold text-slate-700">All caught up!</p>
                    <p className="text-xs text-slate-400 mt-0.5">You have no active pending tasks right now.</p>
                  </div>
                ) : (
                  memberStats.focusTasks.map((t) => {
                    const days = daysUntil(t.due_date);
                    const isLate = days !== null && days < 0 && !["done", "completed"].includes((t.status || "").toLowerCase());
                    const isCompleted = t.status === "Completed";
                    return (
                      <div
                        key={t.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isCompleted
                            ? "bg-amber-50/40 border-amber-200/80"
                            : isLate
                            ? "bg-rose-50/40 border-rose-200/80"
                            : "bg-white border-slate-200/70 hover:border-indigo-300"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                              t.status === "In Progress" ? "bg-blue-50 text-blue-700 border-blue-200" :
                              t.status === "Completed" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-slate-100 text-slate-700 border-slate-200"
                            }`}>
                              {t.status || "To Do"}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {t.project_name}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 truncate">{t.name || t.title}</h4>
                          {t.due_date && (
                            <p className={`text-[11px] font-medium mt-1 flex items-center gap-1 ${
                              isLate ? "text-rose-600 font-bold" : days === 0 ? "text-amber-600 font-bold" : "text-slate-400"
                            }`}>
                              <Clock size={11} />
                              {isLate ? `${Math.abs(days!)} days overdue` : days === 0 ? "Due today" : `Due in ${days} days (${new Date(t.due_date).toLocaleDateString()})`}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => router.push("/tasks")}
                            className="px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            Open Task →
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Personal Status & Priority */}
            <div className="space-y-5">
              {/* Personal Donut Chart */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={15} className="text-indigo-500" />
                  <h3 className="text-sm font-bold text-gray-900">Personal Task Status</h3>
                </div>
                <div className="flex items-center gap-5 justify-center flex-wrap">
                  <DonutChart
                    size={140}
                    stroke={18}
                    label={`${memberStats.rate}%`}
                    sublabel="Completed"
                    segments={[
                      { value: memberStats.done, color: "#10b981", label: "Completed" },
                      { value: memberStats.completedPendingReview, color: "#f59e0b", label: "Completed" },
                      { value: memberStats.inProgress, color: "#6366f1", label: "In Progress" },
                      { value: memberStats.todo, color: "#cbd5e1", label: "To Do" },
                    ]}
                  />
                  <div className="space-y-2">
                    {[
                      { label: "Completed", value: memberStats.done, color: "#10b981" },
                      { label: "In Review", value: memberStats.completedPendingReview, color: "#f59e0b" },
                      { label: "In Progress", value: memberStats.inProgress, color: "#6366f1" },
                      { label: "To Do", value: memberStats.todo, color: "#cbd5e1" },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        <span className="text-[11px] text-gray-600 font-medium w-20">{s.label}</span>
                        <span className="text-[12px] font-bold text-gray-900">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Contributing Projects Mini-Card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contributing Projects</h3>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {memberStats.memberProjects.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {memberStats.memberProjects.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">No projects assigned yet</p>
                  ) : (
                    memberStats.memberProjects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => router.push(`/projects/${p.id}`)}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/50 transition-colors flex items-center justify-between cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400">{p.domain || "General"}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {p.progress || 0}%
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Member Row 3: All Program Deliverables ── */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderKanban size={16} className="text-indigo-500" />
                <h3 className="text-base font-bold text-gray-900">
                  Program Initiatives & Deliverables {selectedProgram && <span className="text-xs font-normal text-indigo-600">({selectedProgram.name})</span>}
                </h3>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">{scopedProjects.length}</span>
              </div>
              <button onClick={() => router.push("/projects")} className="text-[12px] text-indigo-600 font-semibold hover:text-indigo-800 transition-colors flex items-center gap-1">
                View all projects <ChevronRight size={13} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {scopedProjects.map((p, i) => {
                const projectTasks = tasks.filter((t) => t.project_id === p.id);
                const doneTasks = projectTasks.filter((t) => t.status === "Completed" || t.status === "Done").length;
                const prog = projectTasks.length > 0 
                  ? Math.round((doneTasks / projectTasks.length) * 100) 
                  : (["unassigned", "not started"].includes((p.status || "").toLowerCase()) ? 0 : (p.progress || 0));
                const days = daysUntil(p.deadline);
                const isOverdue = days !== null && days < 0 && !["completed", "done"].includes((p.status || "").toLowerCase());
                const sc = statusColor(p.status);
                const CARD_GRADIENTS = [
                  "from-indigo-500/10 to-violet-500/5",
                  "from-blue-500/10 to-cyan-500/5",
                  "from-emerald-500/10 to-teal-500/5",
                  "from-rose-500/10 to-pink-500/5",
                  "from-amber-500/10 to-orange-500/5",
                  "from-violet-500/10 to-purple-500/5",
                ];
                return (
                  <div
                    key={p.id}
                    className={`bg-gradient-to-br ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]} border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden`}
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <div className="absolute top-3 right-3">
                      <RadialProgress pct={prog} color={sc} size={44} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] font-black text-gray-700" style={{ fontSize: "9px" }}>{prog}%</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 mb-4 pr-12">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${sc}22` }}>
                        <FolderKanban size={16} style={{ color: sc }} />
                      </div>
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded mb-0.5">
                          <Layers size={9} /> {getProjectProgram(p).name}
                        </span>
                        <h4 className="text-[13px] font-bold text-gray-900 group-hover:text-indigo-700 transition-colors line-clamp-1">{p.name}</h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">{p.domain || "General"}</p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${prog}%`, background: `linear-gradient(to right, ${sc}cc, ${sc})` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
                        <span>{doneTasks}/{projectTasks.length} tasks</span>
                        {days !== null && (
                          <span className={`flex items-center gap-1 ${isOverdue ? "text-rose-600 font-bold" : "text-gray-400"}`}>
                            <Clock size={10} />
                            {isOverdue ? `${Math.abs(days)}d late` : days === 0 ? "Due today" : `${days}d left`}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border" style={{ color: sc, borderColor: `${sc}44`, background: `${sc}11` }}>
                        {p.status || "Active"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
