"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Layers, Plus, Search, Calendar, Flag, User, Users,
  CheckCircle2, AlertCircle, Clock, ChevronRight, ArrowLeft,
  X, RefreshCw, ShieldCheck, FolderKanban, UserPlus, Eye,
  Sparkles, MoreVertical, Briefcase
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProgram } from "@/context/ProgramContext";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE, getAuthHeaders } from "@/lib/api";

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

type ProgramProject = {
  id: string;
  program_id: string;
  name: string;
  domain: string | null;
  about_title: string | null;
  about_description: string | null;
  status: string;
  priority: ProgramPriority;
  start_date: string | null;
  deadline: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_to_role: string | null;
};

type AssignableUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

function formatDate(d?: string | null) {
  if (!d) return "Not set";
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d || "Not set";
  }
}

function getInitial(name?: string | null) {
  if (!name) return "U";
  return name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function ProgramsView({
  onSelectProgram,
  onSwitchToProjects,
}: {
  onSelectProgram?: (program: Program) => void;
  onSwitchToProjects?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedProgram, selectProgram, programs: contextPrograms } = useProgram();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [programProjects, setProgramProjects] = useState<ProgramProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Modals
  const [createProgramOpen, setCreateProgramOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssignProjectId, setSelectedAssignProjectId] = useState<string | null>(null);
  const [selectedAssignUserId, setSelectedAssignUserId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Program form
  const [pForm, setPForm] = useState({
    name: "",
    description: "",
    domain: "",
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "17:00",
    priority: "Medium" as ProgramPriority,
  });
  const [savingProgram, setSavingProgram] = useState(false);

  // Project under program form
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

  const getHeaders = () => getAuthHeaders();

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
      project_count: cp.id === "prog-core-fintech" ? 4 : cp.id === "prog-ai-intelligence" ? 3 : 2,
      completed_count: cp.id === "prog-core-fintech" ? 2 : 1,
      created_at: new Date().toISOString(),
    }));
  };

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/programs`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && Array.isArray(data.programs)) {
        setPrograms(data.programs);
      } else {
        setPrograms(getFallbackPrograms());
      }
    } catch (e) {
      console.warn("Using fallback programs due to fetch error:", e);
      setPrograms(getFallbackPrograms());
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignableUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/programs/assignable-users`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setAssignableUsers(data.users || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProgramDetails = async (programId: string) => {
    try {
      setLoadingProjects(true);
      const res = await fetch(`${API_BASE}/programs/${programId}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && data.program) {
        setActiveProgram(data.program);
        setProgramProjects(data.projects || []);
      } else {
        const found = programs.find((p) => p.id === programId) || getFallbackPrograms().find((p) => p.id === programId);
        if (found) {
          setActiveProgram(found);
          setProgramProjects([
            {
              id: `p-${programId}-1`,
              program_id: programId,
              name: `${found.name} Core Initiative`,
              domain: found.domain,
              about_title: "High priority platform deliverable",
              about_description: "Architectural development and core milestones for this program.",
              status: "In Progress",
              priority: "High",
              start_date: "2025-01-15",
              deadline: "2025-06-30",
              assigned_to: "mgr-1",
              assigned_to_name: "Alex Sterling (Lead)",
              assigned_to_email: "alex@argplatform.com",
              assigned_to_role: "Project Manager",
            },
            {
              id: `p-${programId}-2`,
              program_id: programId,
              name: `${found.domain || "Enterprise"} Microservices & API`,
              domain: found.domain,
              about_title: "Security and integration module",
              about_description: "Zero-trust compliance, API connectors, and automated CI/CD pipeline.",
              status: "Done",
              priority: "Medium",
              start_date: "2025-02-01",
              deadline: "2025-05-15",
              assigned_to: "mgr-2",
              assigned_to_name: "Sarah Chen",
              assigned_to_email: "sarah@argplatform.com",
              assigned_to_role: "Engineering Manager",
            }
          ]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
    fetchAssignableUsers();
  }, []);

  const handleOpenProgram = (program: Program) => {
    setActiveProgram(program);
    fetchProgramDetails(program.id);
    if (onSelectProgram) onSelectProgram(program);
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pForm.name.trim()) return;
    setSavingProgram(true);
    try {
      const res = await fetch(`${API_BASE}/programs`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          name: pForm.name.trim(),
          description: pForm.description.trim() || null,
          domain: pForm.domain.trim() || null,
          startDate: pForm.startDate || null,
          endDate: pForm.endDate || null,
          priority: pForm.priority,
        }),
      });
      if (res.ok) {
        setCreateProgramOpen(false);
        setPForm({ name: "", description: "", domain: "", startDate: "", startTime: "09:00", endDate: "", endTime: "17:00", priority: "Medium" });
        fetchPrograms();
        window.dispatchEvent(new Event("programsUpdated"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingProgram(false);
    }
  };

  const handleCreateProjectUnderProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProgram || !prForm.name.trim()) return;
    setSavingProject(true);
    try {
      const res = await fetch(`${API_BASE}/programs/${activeProgram.id}/projects`, {
        method: "POST",
        headers: getHeaders(),
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
      });
      if (res.ok) {
        setCreateProjectOpen(false);
        setPrForm({
          name: "", domain: "", aboutTitle: "", aboutDescription: "",
          startDate: "", startTime: "09:00", deadline: "", deadlineTime: "17:00", priority: "Medium", assignedTo: ""
        });
        fetchProgramDetails(activeProgram.id);
        fetchPrograms();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingProject(false);
    }
  };

  const handleAssignProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProgram || !selectedAssignProjectId || !selectedAssignUserId) return;
    setAssigning(true);
    try {
      const res = await fetch(
        `${API_BASE}/programs/${activeProgram.id}/projects/${selectedAssignProjectId}/assign`,
        {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({ assignedTo: selectedAssignUserId }),
        }
      );
      if (res.ok) {
        setAssignModalOpen(false);
        setSelectedAssignProjectId(null);
        setSelectedAssignUserId("");
        fetchProgramDetails(activeProgram.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAssigning(false);
    }
  };

  const filteredPrograms = useMemo(() => {
    const q = search.toLowerCase();
    return programs.filter(p =>
      !q || p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      (p.domain || "").toLowerCase().includes(q)
    );
  }, [programs, search]);

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase();
    return programProjects.filter(p =>
      !q || p.name.toLowerCase().includes(q) ||
      (p.domain || "").toLowerCase().includes(q) ||
      (p.assigned_to_name || "").toLowerCase().includes(q)
    );
  }, [programProjects, search]);

  return (
    <div className="space-y-6">
      {/* ── Drill-down Banner or Main Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Layers size={12} /> Executive Hierarchy
            </span>
            {activeProgram && (
              <span className="text-xs font-semibold text-slate-400">/ {activeProgram.name}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            {activeProgram ? activeProgram.name : "Teams & Strategic Programs"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeProgram
              ? activeProgram.description || "Projects and team leads managed under this initiative."
              : "Select a program/team to inspect assigned projects, assign managers, and steer delivery."}
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
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles size={13} /> Open Program Dashboard →
              </button>
              {onSwitchToProjects && (
                <button
                  type="button"
                  onClick={() => {
                    selectProgram(activeProgram.id);
                    onSwitchToProjects();
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all flex items-center gap-1"
                >
                  View in Portfolio →
                </button>
              )}
              <button
                onClick={() => { setActiveProgram(null); setProgramProjects([]); }}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Back to All Programs
              </button>
              <button
                onClick={() => setCreateProjectOpen(true)}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                <Plus size={14} /> Add Project
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => fetchPrograms()}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all"
                title="Refresh programs"
              >
                <RefreshCw size={15} />
              </button>
              <button
                onClick={() => setCreateProgramOpen(true)}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                <Plus size={14} /> New Program / Team
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={activeProgram ? "Search projects in this program..." : "Search programs..."}
          className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
        />
      </div>

      {/* ── LIST OF PROGRAMS (Top Level) ── */}
      {!activeProgram && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPrograms.length === 0 ? (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <Layers size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No programs or teams found</p>
              <p className="text-xs text-slate-400 mt-0.5">Create your first program to group and supervise projects.</p>
            </div>
          ) : (
            filteredPrograms.map(p => {
              const pct = p.project_count > 0 ? Math.round((p.completed_count / p.project_count) * 100) : 0;
              const isSelected = selectedProgram?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    selectProgram(p.id);
                    router.push("/dashboard");
                  }}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between cursor-pointer group relative ${
                    isSelected
                      ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/15"
                      : "border-slate-200/90 hover:border-indigo-300"
                  }`}
                >
                  <div>
                    {isSelected && (
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Active Team Scope
                        </span>
                        <span className="text-[10px] text-indigo-600 font-medium">Platform Scoped</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Layers size={18} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            {p.name}
                          </h3>
                          <p className="text-[11px] font-medium text-slate-400 truncate">
                            {p.domain || "Strategic Initiative"}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        p.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        p.status === "Completed" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {p.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                      {p.description || "No description provided for this program."}
                    </p>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-semibold text-slate-500">Project Completion</span>
                        <span className="font-bold text-slate-800">{p.completed_count} / {p.project_count} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <Calendar size={12} />
                        <span>{formatDate(p.start_date)} - {formatDate(p.end_date)}</span>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-indigo-600 group-hover:translate-x-1 transition-transform text-xs">
                        Open Dashboard <ChevronRight size={13} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectProgram(p.id);
                          router.push("/dashboard");
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                            : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                        }`}
                      >
                        <Sparkles size={13} />
                        {isSelected ? "Active Dashboard →" : "Open Program Dashboard →"}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProgram(p);
                        }}
                        className="py-1.5 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1"
                        title="View Deliverables & Projects list"
                      >
                        Deliverables
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── DRILL-DOWN: PROJECTS IN THIS PROGRAM ── */}
      {activeProgram && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.length === 0 ? (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                <FolderKanban size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No projects grouped in this program yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Click 'Add Project' to assign deliverables to this program.</p>
              </div>
            ) : (
              filteredProjects.map(proj => (
                <div
                  key={proj.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/projects/${proj.id}`} className="group/title block">
                          <h4 className="text-sm font-bold text-slate-900 group-hover/title:text-indigo-600 transition-colors line-clamp-1">{proj.name}</h4>
                        </Link>
                        <p className="text-[11px] text-slate-400 font-medium">{proj.domain || "General"}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        proj.status === "Done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        proj.status === "In Progress" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {proj.status}
                      </span>
                    </div>

                    {proj.about_description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-2 leading-relaxed">
                        {proj.about_description}
                      </p>
                    )}

                    {/* Manager / Lead Assignment Box */}
                    <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                          {getInitial(proj.assigned_to_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {proj.assigned_to_name || "Unassigned Lead"}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {proj.assigned_to_role || "No Manager Assigned"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedAssignProjectId(proj.id);
                          setSelectedAssignUserId(proj.assigned_to || "");
                          setAssignModalOpen(true);
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-2xs hover:bg-slate-50 transition-all flex-shrink-0"
                      >
                        {proj.assigned_to ? "Reassign" : "Assign"}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-400">
                      Due: {formatDate(proj.deadline)}
                    </span>
                    <Link
                      href={`/projects/${proj.id}`}
                      className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      Project Details <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── CREATE PROGRAM MODAL ── */}
      {createProgramOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">Create New Program / Team</h3>
              <button onClick={() => setCreateProgramOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateProgram} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Program Name *
                </label>
                <input
                  required
                  value={pForm.name}
                  onChange={e => setPForm({ ...pForm, name: e.target.value })}
                  placeholder="e.g. Core Banking Transformation"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Domain / Tribe
                  </label>
                  <input
                    value={pForm.domain}
                    onChange={e => setPForm({ ...pForm, domain: e.target.value })}
                    placeholder="e.g. Fintech"
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Priority
                  </label>
                  <select
                    value={pForm.priority}
                    onChange={e => setPForm({ ...pForm, priority: e.target.value as ProgramPriority })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Start Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={pForm.startDate}
                    onChange={e => setPForm({ ...pForm, startDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Start Time *
                  </label>
                  <input
                    required
                    type="time"
                    value={pForm.startTime}
                    onChange={e => setPForm({ ...pForm, startTime: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Target End Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={pForm.endDate}
                    onChange={e => setPForm({ ...pForm, endDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Target End Time *
                  </label>
                  <input
                    required
                    type="time"
                    value={pForm.endTime}
                    onChange={e => setPForm({ ...pForm, endTime: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={pForm.description}
                  onChange={e => setPForm({ ...pForm, description: e.target.value })}
                  placeholder="Goals and strategic scope..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateProgramOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProgram}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm disabled:opacity-50"
                >
                  {savingProgram ? "Creating..." : "Create Program"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE PROJECT IN PROGRAM MODAL ── */}
      {createProjectOpen && activeProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">Add Project to {activeProgram.name}</h3>
              <button onClick={() => setCreateProjectOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateProjectUnderProgram} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Project Title *
                </label>
                <input
                  required
                  value={prForm.name}
                  onChange={e => setPrForm({ ...prForm, name: e.target.value })}
                  placeholder="e.g. Payment Gateway V2"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Assign Manager / Lead
                  </label>
                  <select
                    value={prForm.assignedTo}
                    onChange={e => setPrForm({ ...prForm, assignedTo: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  >
                    <option value="">Select manager...</option>
                    {assignableUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Priority
                  </label>
                  <select
                    value={prForm.priority}
                    onChange={e => setPrForm({ ...prForm, priority: e.target.value as ProgramPriority })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Start Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={prForm.startDate}
                    onChange={e => setPrForm({ ...prForm, startDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Start Time *
                  </label>
                  <input
                    required
                    type="time"
                    value={prForm.startTime}
                    onChange={e => setPrForm({ ...prForm, startTime: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Deadline Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={prForm.deadline}
                    onChange={e => setPrForm({ ...prForm, deadline: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Deadline Time *
                  </label>
                  <input
                    required
                    type="time"
                    value={prForm.deadlineTime}
                    onChange={e => setPrForm({ ...prForm, deadlineTime: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={prForm.aboutDescription}
                  onChange={e => setPrForm({ ...prForm, aboutDescription: e.target.value })}
                  placeholder="Deliverables..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateProjectOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProject}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm disabled:opacity-50"
                >
                  {savingProject ? "Adding..." : "Add Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ASSIGN PROJECT MODAL ── */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">Assign Project Lead</h3>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAssignProject} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Select Project Manager / Lead
                </label>
                <select
                  required
                  value={selectedAssignUserId}
                  onChange={e => setSelectedAssignUserId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                >
                  <option value="">Select member...</option>
                  {assignableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} — {u.role}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedAssignUserId}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm disabled:opacity-50"
                >
                  {assigning ? "Saving..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
