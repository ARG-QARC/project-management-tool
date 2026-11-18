"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Layers,
  Plus,
  Search,
  Calendar,
  Flag,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  ArrowLeft,
  X,
  RefreshCw,
  ShieldCheck,
  FolderKanban,
  UserPlus,
  Eye,
  Sparkles,
  MoreVertical,
  Briefcase,
  LayoutGrid,
  List,
  Check,
  TrendingUp,
  Target,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProgram, DEFAULT_PROGRAMS } from "@/context/ProgramContext";
import { SERVER_BASE, API_BASE, getAuthHeaders } from "@/lib/api";

/* =========================================================
   TYPES
========================================================= */

type CurrentUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

type ProgramPriority = "Low" | "Medium" | "High";
type ProgramStatus = "Active" | "Paused" | "Completed";

type Program = {
  id: string;
  name: string;
  description: string | null;
  domain: string | null;
  start_date: string | null;
  end_date: string | null;
  priority: ProgramPriority;
  status: ProgramStatus;
  created_by: string;
  created_by_name: string | null;
  project_count: number;
  completed_count: number;
  created_at: string;
};

type ProgramProjectStatus =
  | "Unassigned"
  | "Backlog"
  | "In Progress"
  | "Paused"
  | "Done";

type ProgramProject = {
  id: string;
  program_id: string;
  name: string;
  domain: string | null;
  about_title: string | null;
  about_description: string | null;
  status: ProgramProjectStatus;
  priority: ProgramPriority;
  start_date: string | null;
  deadline: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_to_role: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  created_by?: string;
  created_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
};

type AssignableUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  job_title?: string | null;
};

/* =========================================================
   HELPERS & BADGES
========================================================= */

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return "Not scheduled";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString || "Not scheduled";
  }
};

const initialsOf = (name?: string | null): string => {
  if (!name) return "TG";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase();
};

const getProgramCode = (name: string): string => {
  if (name.toLowerCase().includes("fintech")) return "FIN";
  if (name.toLowerCase().includes("ai") || name.toLowerCase().includes("platform")) return "AI";
  if (name.toLowerCase().includes("customer") || name.toLowerCase().includes("mobile")) return "CX";
  if (name.toLowerCase().includes("cloud") || name.toLowerCase().includes("ops")) return "OPS";
  return name.slice(0, 3).toUpperCase();
};

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "active" || s === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {status}
      </span>
    );
  }
  if (s === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <CheckCircle2 size={11} className="text-blue-500" />
        {status}
      </span>
    );
  }
  if (s === "paused" || s === "on hold") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={11} className="text-amber-500" />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
      <Sparkles size={11} className="text-indigo-500" />
      {status}
    </span>
  );
}

function PriorityPill({ priority }: { priority: ProgramPriority }) {
  if (priority === "High") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> High
      </span>
    );
  }
  if (priority === "Low") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Medium
    </span>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Programs() {
  const router = useRouter();
  const { selectedProgram, selectProgram, programs: contextPrograms } = useProgram();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  /* Active Program Drill-down */
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [programProjects, setProgramProjects] = useState<ProgramProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  /* Modals */
  const [createProgramModalOpen, setCreateProgramModalOpen] = useState(false);
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssignProjectId, setSelectedAssignProjectId] = useState<string | null>(null);
  const [selectedAssignUserId, setSelectedAssignUserId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  /* Create Program Form */
  const [pForm, setPForm] = useState({
    name: "",
    description: "",
    domain: "",
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "17:00",
    priority: "High" as ProgramPriority,
  });
  const [savingProgram, setSavingProgram] = useState(false);

  /* Create Project under Program Form */
  const [prForm, setPrForm] = useState({
    name: "",
    domain: "",
    aboutTitle: "",
    aboutDescription: "",
    startDate: "",
    startTime: "09:00",
    deadline: "",
    deadlineTime: "17:00",
    priority: "Medium" as ProgramPriority,
    assignedTo: "",
  });
  const [savingProject, setSavingProject] = useState(false);

  const localGetAuthHeaders = () => getAuthHeaders();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const getFallbackPrograms = (): Program[] => {
    return contextPrograms.map((cp) => ({
      id: cp.id,
      name: cp.name,
      description: cp.description,
      domain: cp.domain,
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      priority: "High" as ProgramPriority,
      status: cp.status as ProgramStatus,
      created_by: "system",
      created_by_name: "Executive Leadership",
      project_count:
        cp.id === "prog-core-fintech"
          ? 4
          : cp.id === "prog-ai-intelligence"
          ? 3
          : 2,
      completed_count: cp.id === "prog-core-fintech" ? 2 : 1,
      created_at: new Date().toISOString(),
    }));
  };

  /* =======================================================
     FETCH DATA
  ======================================================= */

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/programs`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.programs)) {
        setPrograms(data.programs);
      } else {
        setPrograms(getFallbackPrograms());
      }
    } catch (err: any) {
      console.warn("Using fallback programs:", err);
      setPrograms(getFallbackPrograms());
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignableUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/programs/assignable-users`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.users)) {
        setAssignableUsers(data.users);
      } else {
        setAssignableUsers([
          { id: "usr-1", full_name: "Alex Sterling", email: "alex@argplatform.com", role: "Project Manager" },
          { id: "usr-2", full_name: "Sarah Chen", email: "sarah@argplatform.com", role: "Engineering Lead" },
          { id: "usr-3", full_name: "Marcus Vance", email: "marcus@argplatform.com", role: "Senior Architect" },
          { id: "usr-4", full_name: "Elena Rostova", email: "elena@argplatform.com", role: "Product Manager" },
        ]);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const fetchProgramDetails = async (programId: string) => {
    try {
      setLoadingProjects(true);
      const res = await fetch(`${API_BASE}/programs/${programId}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.program) {
        setActiveProgram(data.program);
        setProgramProjects(data.projects || []);
      } else {
        const found =
          programs.find((p) => p.id === programId) ||
          getFallbackPrograms().find((p) => p.id === programId);
        if (found) {
          setActiveProgram(found);
          setProgramProjects([
            {
              id: `proj-${programId}-1`,
              program_id: programId,
              name: `${found.name} Core Initiative`,
              domain: found.domain,
              about_title: "Primary high-throughput deliverables",
              about_description: "Architectural milestones, zero-trust APIs, and SLA uptime guarantees.",
              status: "In Progress",
              priority: "High",
              start_date: "2025-01-15",
              deadline: "2025-06-30",
              assigned_to: "usr-1",
              assigned_to_name: "Alex Sterling",
              assigned_to_email: "alex@argplatform.com",
              assigned_to_role: "Project Manager",
            },
            {
              id: `proj-${programId}-2`,
              program_id: programId,
              name: `${found.domain || "Enterprise"} Microservices & API Layer`,
              domain: found.domain,
              about_title: "Platform interoperability & data pipelines",
              about_description: "Automated schema contracts, distributed tracing, and edge failover routing.",
              status: "Done",
              priority: "Medium",
              start_date: "2025-02-01",
              deadline: "2025-05-15",
              assigned_to: "usr-2",
              assigned_to_name: "Sarah Chen",
              assigned_to_email: "sarah@argplatform.com",
              assigned_to_role: "Engineering Lead",
            },
            {
              id: `proj-${programId}-3`,
              program_id: programId,
              name: `${found.name} Security & Compliance Audit`,
              domain: found.domain,
              about_title: "SOC-2 Type II & regulatory certification",
              about_description: "End-to-end vulnerability scanning and posture assessment across environments.",
              status: "Backlog",
              priority: "High",
              start_date: "2025-07-01",
              deadline: "2025-10-31",
              assigned_to: "usr-3",
              assigned_to_name: "Marcus Vance",
              assigned_to_email: "marcus@argplatform.com",
              assigned_to_role: "Senior Architect",
            },
          ]);
        }
      }
    } catch (err: any) {
      console.warn("Using fallback program details:", err);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
    fetchAssignableUsers();
  }, []);

  /* =======================================================
     HANDLERS
  ======================================================= */

  const handleOpenProgram = (program: Program) => {
    setActiveProgram(program);
    fetchProgramDetails(program.id);
  };

  const handleBackToOverview = () => {
    setActiveProgram(null);
    setProgramProjects([]);
    setSearch("");
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pForm.name.trim()) return;
    try {
      setSavingProgram(true);
      setError("");
      const res = await fetch(`${API_BASE}/programs`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: pForm.name.trim(),
          description: pForm.description.trim() || null,
          domain: pForm.domain.trim() || null,
          startDate: pForm.startDate || null,
          startTime: pForm.startTime || "09:00",
          endDate: pForm.endDate || null,
          endTime: pForm.endTime || "17:00",
          priority: pForm.priority,
        }),
      });
      if (res.ok) {
        setCreateProgramModalOpen(false);
        setPForm({
          name: "",
          description: "",
          domain: "",
          startDate: "",
          startTime: "09:00",
          endDate: "",
          endTime: "17:00",
          priority: "High",
        });
        await fetchPrograms();
        window.dispatchEvent(new Event("programsUpdated"));
      } else {
        const data = await res.json();
        throw new Error(data.message || "Failed to create program");
      }
    } catch (err: any) {
      setError(err.message || "Could not save program.");
    } finally {
      setSavingProgram(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProgram || !prForm.name.trim()) return;
    try {
      setSavingProject(true);
      setError("");
      const res = await fetch(
        `${API_BASE}/programs/${activeProgram.id}/projects`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: prForm.name.trim(),
            domain: prForm.domain.trim() || null,
            aboutTitle: prForm.aboutTitle.trim() || null,
            aboutDescription: prForm.aboutDescription.trim() || null,
            startDate: prForm.startDate || null,
            startTime: prForm.startTime || "09:00",
            deadline: prForm.deadline || null,
            deadlineTime: prForm.deadlineTime || "17:00",
            priority: prForm.priority,
            assignedTo: prForm.assignedTo || null,
          }),
        }
      );
      if (res.ok) {
        setCreateProjectModalOpen(false);
        setPrForm({
          name: "",
          domain: "",
          aboutTitle: "",
          aboutDescription: "",
          startDate: "",
          startTime: "09:00",
          deadline: "",
          deadlineTime: "17:00",
          priority: "Medium",
          assignedTo: "",
        });
        await fetchProgramDetails(activeProgram.id);
        await fetchPrograms();
        window.dispatchEvent(new Event("programsUpdated"));
      } else {
        const data = await res.json();
        throw new Error(data.message || "Failed to create deliverable");
      }
    } catch (err: any) {
      setError(err.message || "Could not save project.");
    } finally {
      setSavingProject(false);
    }
  };

  const handleAssignProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProgram || !selectedAssignProjectId || !selectedAssignUserId) return;
    try {
      setAssigning(true);
      const res = await fetch(
        `${API_BASE}/programs/${activeProgram.id}/projects/${selectedAssignProjectId}/assign`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ assignedTo: selectedAssignUserId }),
        }
      );
      if (res.ok) {
        setAssignModalOpen(false);
        setSelectedAssignProjectId(null);
        setSelectedAssignUserId("");
        await fetchProgramDetails(activeProgram.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAssigning(false);
    }
  };

  /* =======================================================
     FILTERS & STATS
  ======================================================= */

  const filteredPrograms = useMemo(() => {
    const q = search.toLowerCase().trim();
    return programs.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.domain || "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        p.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [programs, search, statusFilter]);

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase().trim();
    return programProjects.filter((p) => {
      return (
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.domain || "").toLowerCase().includes(q) ||
        (p.assigned_to_name || "").toLowerCase().includes(q)
      );
    });
  }, [programProjects, search]);

  const totalProjectsAcrossPrograms = useMemo(() => {
    return programs.reduce((acc, p) => acc + (p.project_count || 0), 0);
  }, [programs]);

  const totalCompletedAcrossPrograms = useMemo(() => {
    return programs.reduce((acc, p) => acc + (p.completed_count || 0), 0);
  }, [programs]);

  const overallCompletionRate =
    totalProjectsAcrossPrograms > 0
      ? Math.round((totalCompletedAcrossPrograms / totalProjectsAcrossPrograms) * 100)
      : 0;

  const userRole = (currentUser?.role || "").toLowerCase();
  const isManager =
    userRole.includes("manager") ||
    userRole.includes("administrator") ||
    userRole.includes("admin") ||
    userRole.includes("lead");

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">

        {/* ── Active Scope Indicator Banner ── */}
        {selectedProgram && !activeProgram && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-200/80 rounded-2xl px-5 py-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-200">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Active Workspace Scope</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span className="text-xs font-semibold text-slate-500">Portfolio & Tasks Scoped</span>
                </div>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedProgram.name}
                  <span className="ml-2 text-xs font-medium text-slate-500">({selectedProgram.domain})</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Link
                href="/projects"
                className="px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                View Scoped Portfolio <ChevronRight size={13} />
              </Link>
              {isManager && (
                <button
                  type="button"
                  onClick={() => selectProgram("all")}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer"
                >
                  Clear Scope (View All)
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                <Layers size={13} /> {isManager ? "Executive Steering" : "Assigned Program"}
              </span>
              {activeProgram && (
                <>
                  <span className="text-slate-300">/</span>
                  <span className="text-xs font-bold text-slate-500">{activeProgram.name}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {activeProgram ? activeProgram.name : isManager ? "Programs & Team Initiatives" : "My Program"}
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              {activeProgram
                ? activeProgram.description || "Active deliverables, milestones, and project leads assigned to this team."
                : isManager
                ? "Manage top-level programs, align delivery squads, and scope platform resources by strategic initiative."
                : "View your assigned program deliverables, project milestones, and team roadmaps."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {activeProgram ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    selectProgram(activeProgram.id);
                    router.push("/dashboard");
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles size={14} /> Open {activeProgram.name} Dashboard →
                </button>
                <Link
                  href="/projects"
                  onClick={() => selectProgram(activeProgram.id)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <ExternalLink size={14} /> View in Projects
                </Link>
                <button
                  type="button"
                  onClick={handleBackToOverview}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                {isManager && (
                  <button
                    type="button"
                    onClick={() => setCreateProjectModalOpen(true)}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={15} /> Add Deliverable
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fetchPrograms()}
                  disabled={loading}
                  className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
                  title="Refresh programs"
                >
                  <RefreshCw size={15} className={loading ? "animate-spin text-indigo-600" : ""} />
                </button>
                {isManager && (
                  <button
                    type="button"
                    onClick={() => setCreateProgramModalOpen(true)}
                    className="px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={15} /> New Program / Team
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError("")}
              className="text-rose-500 hover:text-rose-700"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* ── Executive KPI Cards (Top Strip) ── */}
        {!activeProgram && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Programs</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{programs.length}</p>
                <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-1">
                  <TrendingUp size={12} /> {programs.filter((p) => p.status === "Active").length} Active in delivery
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Layers size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Projects</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{totalProjectsAcrossPrograms}</p>
                <p className="text-[11px] font-semibold text-slate-500 mt-1">
                  {totalCompletedAcrossPrograms} completed ({overallCompletionRate}%)
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <FolderKanban size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Squad Leads</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{assignableUsers.length}</p>
                <p className="text-[11px] font-semibold text-indigo-600 mt-1">Assigned cross-functional</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery Velocity</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{overallCompletionRate}%</p>
                <p className="text-[11px] font-semibold text-slate-400 mt-1">Overall completion index</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Target size={22} />
              </div>
            </div>
          </div>
        )}

        {/* ── Toolbar: Search & View Controls ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  activeProgram
                    ? "Search deliverables in this program..."
                    : "Search programs, initiatives, domains..."
                }
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm"
              />
            </div>
          </div>

          {!activeProgram && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                {(["all", "Active", "Completed", "Paused"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer ${
                      statusFilter === s
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "list"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="List view"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================
            PROGRAMS OVERVIEW
        ========================================================= */}
        {!activeProgram && (
          <>
            {loading ? (
              <div className="py-24 text-center">
                <RefreshCw size={28} className="animate-spin text-indigo-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">Loading strategic programs...</p>
                <p className="text-xs text-slate-400 mt-1">Retrieving portfolio hierarchy</p>
              </div>
            ) : filteredPrograms.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-8">
                <Layers size={40} className="text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No programs match your filter</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Adjust your search keyword or create a new strategic program to organize deliverables.
                </p>
                <button
                  onClick={() => setCreateProgramModalOpen(true)}
                  className="mt-4 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> Add New Program
                </button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPrograms.map((p) => {
                  const pct =
                    p.project_count > 0
                      ? Math.round((p.completed_count / p.project_count) * 100)
                      : 0;
                  const isSelected = selectedProgram?.id === p.id;
                  const progCode = getProgramCode(p.name);

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        selectProgram(p.id);
                        router.push("/dashboard");
                      }}
                      className={`group bg-white rounded-2xl border p-6 flex flex-col justify-between cursor-pointer transition-all duration-200 relative hover:shadow-lg hover:-translate-y-0.5 ${
                        isSelected
                          ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-gradient-to-b from-indigo-50/20 to-white shadow-md"
                          : "border-slate-200/80 hover:border-indigo-300 shadow-sm"
                      }`}
                    >
                      {/* Top Accent Bar */}
                      <div
                        className={`absolute inset-x-0 top-0 h-1.5 rounded-t-2xl transition-all ${
                          isSelected
                            ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600"
                            : "bg-slate-200 group-hover:bg-indigo-500"
                        }`}
                      />

                      <div>
                        {/* Scope Indicator Badge */}
                        {isSelected && (
                          <div className="mb-3.5 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 size={12} /> Active Team Scope
                            </span>
                            <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide">
                              Platform Synced
                            </span>
                          </div>
                        )}

                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-xs shadow-md shadow-indigo-100 shrink-0">
                              {progCode}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                {p.name}
                              </h3>
                              <p className="text-xs font-semibold text-slate-400 truncate mt-0.5">
                                {p.domain || "Enterprise Strategic Initiative"}
                              </p>
                            </div>
                          </div>
                          <StatusPill status={p.status} />
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-2 mb-4">
                          {p.description || "Long-range organizational initiative coordinating multi-quarter milestones."}
                        </p>

                        {/* Progress Bar Container */}
                        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 mb-4 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Deliverables Progress
                            </span>
                            <span className="font-bold text-slate-800">
                              {p.completed_count} / {p.project_count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Priority & Timeline Chips */}
                        <div className="flex items-center justify-between text-xs pt-1 mb-4">
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <Calendar size={13} className="text-slate-400" />
                            <span>{formatDate(p.start_date)} - {formatDate(p.end_date)}</span>
                          </div>
                          <PriorityPill priority={p.priority} />
                        </div>
                      </div>

                      {/* Card Action Controls */}
                      <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectProgram(p.id);
                              router.push("/dashboard");
                            }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200"
                            }`}
                          >
                            <Sparkles size={14} />
                            {isSelected ? "Active Dashboard →" : "Open Program Dashboard →"}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProgram(p);
                            }}
                            className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                            title="Inspect squad deliverables & milestones"
                          >
                            <Eye size={13} /> Deliverables
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List / Table View */
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3.5 px-5">Program & Domain</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Priority</th>
                      <th className="py-3.5 px-4">Deliverables</th>
                      <th className="py-3.5 px-4">Timeline</th>
                      <th className="py-3.5 px-5 text-right">Scope Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPrograms.map((p) => {
                      const isSelected = selectedProgram?.id === p.id;
                      const pct =
                        p.project_count > 0
                          ? Math.round((p.completed_count / p.project_count) * 100)
                          : 0;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => {
                            selectProgram(p.id);
                            router.push("/dashboard");
                          }}
                          className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                            isSelected ? "bg-indigo-50/30" : ""
                          }`}
                        >
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
                                {getProgramCode(p.name)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{p.name}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{p.domain}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <StatusPill status={p.status} />
                          </td>
                          <td className="py-4 px-4">
                            <PriorityPill priority={p.priority} />
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-32 space-y-1">
                              <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                                <span>{p.completed_count}/{p.project_count}</span>
                                <span>{pct}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-500 text-[11px]">
                            {formatDate(p.start_date)} – {formatDate(p.end_date)}
                          </td>
                          <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                selectProgram(p.id);
                                router.push("/dashboard");
                              }}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200"
                            >
                              Open Dashboard →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* =========================================================
            ACTIVE PROGRAM DRILL-DOWN (Deliverables, Leads, Milestones)
        ========================================================= */}
        {activeProgram && (
          <div className="space-y-6">

            {/* Drill-down Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Deliverables</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{programProjects.length}</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  {programProjects.filter((p) => p.status === "Done").length} completed deliverables
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Leads</p>
                <p className="text-2xl font-black text-indigo-600 mt-1">
                  {new Set(programProjects.map((p) => p.assigned_to).filter(Boolean)).size}
                </p>
                <p className="text-xs font-semibold text-slate-500 mt-1">Cross-functional managers</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Program Status</p>
                <div className="mt-2">
                  <StatusPill status={activeProgram.status} />
                </div>
                <p className="text-xs font-semibold text-slate-400 mt-1.5">
                  Priority: {activeProgram.priority}
                </p>
              </div>
            </div>

            {/* Projects Grid Under This Program */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">
                  Projects & Deliverables in {activeProgram.name}
                </h2>
                <span className="text-xs font-semibold text-slate-400">
                  {filteredProjects.length} items
                </span>
              </div>

              {loadingProjects ? (
                <div className="py-20 text-center">
                  <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">Loading deliverables...</p>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8">
                  <FolderKanban size={36} className="text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800">No deliverables added yet</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click 'Add Deliverable' to assign milestones to this program.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredProjects.map((proj) => (
                    <div
                      key={proj.id}
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all p-5 flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wide">
                            {proj.domain || activeProgram.domain || "Deliverable"}
                          </span>
                          <StatusPill status={proj.status} />
                        </div>

                        <Link href={`/projects/${proj.id}`} className="group/title block">
                          <h4 className="text-sm font-bold text-slate-900 group-hover/title:text-indigo-600 transition-colors line-clamp-1 mt-1">
                            {proj.name}
                          </h4>
                        </Link>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-1.5">
                          {proj.about_description || "High-priority milestone scoped under this program squad."}
                        </p>
                      </div>

                      {/* Lead / Assignee section */}
                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                              {initialsOf(proj.assigned_to_name)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-[11px]">
                                {proj.assigned_to_name || "Unassigned"}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {proj.assigned_to_role || "Delivery Lead"}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssignProjectId(proj.id);
                              setSelectedAssignUserId(proj.assigned_to || "");
                              setAssignModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-200 cursor-pointer"
                          >
                            {proj.assigned_to ? "Reassign" : "Assign Lead"}
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>Deadline: {formatDate(proj.deadline)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <PriorityPill priority={proj.priority} />
                            <Link
                              href={`/projects/${proj.id}`}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 ml-1"
                            >
                              Open <ChevronRight size={12} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL 1: CREATE PROGRAM
        ========================================================= */}
        {createProgramModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Layers size={17} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">New Program / Strategic Team</h3>
                </div>
                <button
                  onClick={() => setCreateProgramModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateProgram} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Program Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NextGen Core Banking"
                    value={pForm.name}
                    onChange={(e) => setPForm({ ...pForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Strategic Domain
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Financial Services"
                      value={pForm.domain}
                      onChange={(e) => setPForm({ ...pForm, domain: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Priority Level
                    </label>
                    <select
                      value={pForm.priority}
                      onChange={(e) => setPForm({ ...pForm, priority: e.target.value as ProgramPriority })}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-medium"
                    >
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Mission & Scope Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe program objectives, leadership steering, and targets..."
                    value={pForm.description}
                    onChange={(e) => setPForm({ ...pForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-medium resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Start Date *
                    </label>
                    <input
                      required
                      type="date"
                      value={pForm.startDate}
                      onChange={(e) => setPForm({ ...pForm, startDate: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Start Time *
                    </label>
                    <input
                      required
                      type="time"
                      value={pForm.startTime}
                      onChange={(e) => setPForm({ ...pForm, startTime: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Target End Date *
                    </label>
                    <input
                      required
                      type="date"
                      value={pForm.endDate}
                      onChange={(e) => setPForm({ ...pForm, endDate: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Target End Time *
                    </label>
                    <input
                      required
                      type="time"
                      value={pForm.endTime}
                      onChange={(e) => setPForm({ ...pForm, endTime: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCreateProgramModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProgram || !pForm.name.trim()}
                    className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingProgram ? "Creating..." : "Create Program"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL 2: ADD DELIVERABLE UNDER PROGRAM
        ========================================================= */}
        {createProjectModalOpen && activeProgram && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Deliverable</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Adding to {activeProgram.name}</p>
                </div>
                <button
                  onClick={() => setCreateProjectModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Deliverable Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Identity OAuth2 Microservice"
                    value={prForm.name}
                    onChange={(e) => setPrForm({ ...prForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Sub-domain / Category
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Security & IAM"
                      value={prForm.domain}
                      onChange={(e) => setPrForm({ ...prForm, domain: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Lead Assignee
                    </label>
                    <select
                      value={prForm.assignedTo}
                      onChange={(e) => setPrForm({ ...prForm, assignedTo: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-medium"
                    >
                      <option value="">Unassigned</option>
                      {assignableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Description & Target Milestones
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Key specifications, deliverables, and acceptance criteria..."
                    value={prForm.aboutDescription}
                    onChange={(e) => setPrForm({ ...prForm, aboutDescription: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-medium resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Start Date *
                    </label>
                    <input
                      required
                      type="date"
                      value={prForm.startDate}
                      onChange={(e) => setPrForm({ ...prForm, startDate: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Start Time *
                    </label>
                    <input
                      required
                      type="time"
                      value={prForm.startTime}
                      onChange={(e) => setPrForm({ ...prForm, startTime: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Deadline Date *
                    </label>
                    <input
                      required
                      type="date"
                      value={prForm.deadline}
                      onChange={(e) => setPrForm({ ...prForm, deadline: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Deadline Time *
                    </label>
                    <input
                      required
                      type="time"
                      value={prForm.deadlineTime}
                      onChange={(e) => setPrForm({ ...prForm, deadlineTime: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCreateProjectModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProject || !prForm.name.trim()}
                    className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingProject ? "Adding..." : "Add Deliverable"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL 3: ASSIGN PROJECT LEAD
        ========================================================= */}
        {assignModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Assign Project Lead</h3>
                <button
                  onClick={() => setAssignModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAssignProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Select Team Lead
                  </label>
                  <select
                    required
                    value={selectedAssignUserId}
                    onChange={(e) => setSelectedAssignUserId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-medium"
                  >
                    <option value="">Select a member...</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} — {u.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAssignModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigning || !selectedAssignUserId}
                    className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {assigning ? "Assigning..." : "Confirm Lead"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
