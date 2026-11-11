"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Users, FolderKanban, Layers, Plus, Search, ShieldCheck,
  CheckCircle2, AlertCircle, Clock, Calendar, Mail,
  UserPlus, Sparkles, Filter, RefreshCw, ChevronRight,
  ExternalLink, UserCheck, Trash2, X, Lock, Building, Tag, FileText, Eye, Check, TrendingUp, Activity, Briefcase,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE, getAuthHeaders } from "@/lib/api";

type UserItem = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  job_title?: string;
  remarks?: string;
  is_active: boolean;
  created_at?: string;
  projects?: any[];
  tasks?: any[];
  taskStats?: {
    total: number;
    completed: number;
    in_progress: number;
    to_do: number;
  };
};

type ProgramItem = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  domain?: string;
  priority?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
};

type ProjectItem = {
  id: string;
  name: string;
  domain?: string;
  status?: string;
  priority?: string;
  progress?: number;
  program_id?: string;
  manager_name?: string;
  manager_email?: string;
  start_date?: string;
  deadline?: string;
};

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const roleLower = (user?.role || "").toLowerCase();
  const isAdmin = user?.role === "System Administrator" || roleLower === "system administrator";

  useEffect(() => {
    if (user && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, isAdmin, router]);

  const [activeTab, setActiveTab] = useState<"overview" | "members" | "programs" | "projects">("overview");
  const [loading, setLoading] = useState(true);

  // Data states
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [programsList, setProgramsList] = useState<ProgramItem[]>([]);
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [isAssignProjectOpen, setIsAssignProjectOpen] = useState(false);
  const [projectToAssign, setProjectToAssign] = useState<ProjectItem | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Member Form
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "Member",
    jobTitle: "AI & Software Specialist",
  });

  // Program Form
  const [programForm, setProgramForm] = useState({
    name: "",
    code: "",
    domain: "Quantum AI & Deep Tech",
    priority: "High",
    description: "",
    startDate: "",
    endDate: "",
  });

  // Member Profile & Remarks Modal State
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserItem | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [userRemarksText, setUserRemarksText] = useState("");
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [remarksSuccess, setRemarksSuccess] = useState(false);

  const openProfileModal = async (u: UserItem) => {
    setSelectedProfileUser(u);
    setUserRemarksText(u.remarks || "");
    setRemarksSuccess(false);
    setLoadingProfile(true);

    try {
      const res = await fetch(`${API_BASE}/users/${u.id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const d = await res.json();
        const profileData = d.user || d.data || d;
        setSelectedProfileUser(prev => ({
          ...prev!,
          ...profileData,
          remarks: profileData.remarks !== undefined ? profileData.remarks : prev?.remarks
        }));
        setUserRemarksText(profileData.remarks || "");
      }
    } catch (err) {
      console.error("Failed to load user profile", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSaveRemarks = async () => {
    if (!selectedProfileUser) return;
    setSavingRemarks(true);
    setRemarksSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/users/${selectedProfileUser.id}/remarks`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ remarks: userRemarksText }),
      });

      if (res.ok) {
        setRemarksSuccess(true);
        // Update local state in usersList
        setUsersList(prev => prev.map(usr => usr.id === selectedProfileUser.id ? { ...usr, remarks: userRemarksText } : usr));
        setSelectedProfileUser(prev => prev ? { ...prev, remarks: userRemarksText } : null);
        setTimeout(() => setRemarksSuccess(false), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || data.error || "Failed to save remarks");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save remarks");
    } finally {
      setSavingRemarks(false);
    }
  };

  // Project Form
  const [projectForm, setProjectForm] = useState({
    name: "",
    domain: "Autonomous Agents",
    programId: "",
    priority: "Medium",
    aboutTitle: "",
    aboutDescription: "",
    startDate: "",
    deadline: "",
    assigneeId: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      const [usersRes, progRes, projRes] = await Promise.all([
        fetch(`${API_BASE}/users`, { headers }).catch(() => null),
        fetch(`${API_BASE}/programs`, { headers }).catch(() => null),
        fetch(`${API_BASE}/projects`, { headers }).catch(() => null),
      ]);

      if (usersRes?.ok) {
        const ud = await usersRes.json();
        setUsersList(ud.users || ud.data || []);
      } else {
        // Fallback to assignable-users if /users is restricted
        const alt = await fetch(`${API_BASE}/programs/assignable-users`, { headers }).catch(() => null);
        if (alt?.ok) {
          const ad = await alt.json();
          setUsersList(ad.users || []);
        }
      }

      if (progRes?.ok) {
        const pd = await progRes.json();
        setProgramsList(pd.programs || pd.data || []);
      }

      if (projRes?.ok) {
        const prd = await projRes.json();
        setProjectsList(prd.projects || prd.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers: Add Member
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(userForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create member");
      }
      setIsAddUserOpen(false);
      setUserForm({
        fullName: "",
        email: "",
        password: "",
        role: "Member",
        jobTitle: "AI & Software Specialist",
      });
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create member");
    } finally {
      setSaving(false);
    }
  };

  // Handlers: Add Program
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(`${API_BASE}/programs`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(programForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create program");
      }
      setIsAddProgramOpen(false);
      setProgramForm({
        name: "",
        code: "",
        domain: "Quantum AI & Deep Tech",
        priority: "High",
        description: "",
        startDate: "",
        endDate: "",
      });
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create program");
    } finally {
      setSaving(false);
    }
  };

  // Handlers: Add Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(`${API_BASE}/projects`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: projectForm.name,
          domain: projectForm.domain,
          programId: projectForm.programId || null,
          priority: projectForm.priority,
          aboutTitle: projectForm.aboutTitle,
          aboutDescription: projectForm.aboutDescription,
          startDate: projectForm.startDate || null,
          deadline: projectForm.deadline || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create project");
      }

      // If assignee selected, assign immediately
      const createdId = data.project?.id || data.id;
      if (createdId && projectForm.assigneeId) {
        await fetch(`${API_BASE}/projects/${createdId}/assign`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId: projectForm.assigneeId }),
        }).catch(() => null);
      }

      setIsAddProjectOpen(false);
      setProjectForm({
        name: "",
        domain: "Autonomous Agents",
        programId: "",
        priority: "Medium",
        aboutTitle: "",
        aboutDescription: "",
        startDate: "",
        deadline: "",
        assigneeId: "",
      });
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  // Handlers: Assign Project
  const handleAssignProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToAssign || !selectedAssigneeId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/projects/${projectToAssign.id}/assign`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: selectedAssigneeId, managerId: selectedAssigneeId }),
      });
      if (res.ok) {
        setIsAssignProjectOpen(false);
        setProjectToAssign(null);
        setSelectedAssigneeId("");
        fetchData();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.message || "Failed to assign project");
      }
    } catch (err: any) {
      alert(err.message || "Failed to assign project");
    } finally {
      setSaving(false);
    }
  };

  // Handlers: Toggle User Status
  const handleToggleUserStatus = async (targetUser: UserItem) => {
    try {
      const res = await fetch(`${API_BASE}/users/${targetUser.id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !targetUser.is_active }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handlers: Delete User
  const handleDeleteUser = async (targetUser: UserItem) => {
    if (!confirm(`Are you sure you want to delete member "${targetUser.full_name}"? All assigned tasks will be unassigned.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/users/${targetUser.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || data.error || "Failed to delete user");
        return;
      }
      fetchData();
    } catch (e: any) {
      alert(e.message || "Failed to delete user");
    }
  };

  // Handlers: Delete Program
  const handleDeleteProgram = async (targetProgram: ProgramItem) => {
    if (!confirm(`Are you sure you want to delete program "${targetProgram.name}"? This will also remove associated deliverables.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/programs/${targetProgram.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || data.error || "Failed to delete program");
        return;
      }
      fetchData();
    } catch (e: any) {
      alert(e.message || "Failed to delete program");
    }
  };

  // Handlers: Delete Project
  const handleDeleteProject = async (targetProject: ProjectItem) => {
    if (!confirm(`Are you sure you want to delete project "${targetProject.name}"? All associated tasks, submissions, and attachments will be deleted.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/projects/${targetProject.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || data.error || "Failed to delete project");
        return;
      }
      fetchData();
    } catch (e: any) {
      alert(e.message || "Failed to delete project");
    }
  };

  // Filtered lists
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      const matchesSearch = !search ||
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.job_title || "").toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || u.role.toLowerCase() === roleFilter.toLowerCase();
      return matchesSearch && matchesRole;
    });
  }, [usersList, search, roleFilter]);

  const filteredProjects = useMemo(() => {
    return projectsList.filter(p => {
      return !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.domain || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.manager_name || "").toLowerCase().includes(search.toLowerCase());
    });
  }, [projectsList, search]);

  const stats = useMemo(() => {
    const activeUsers = usersList.filter(u => u.is_active).length;
    const unassignedProjects = projectsList.filter(p => p.status === "Unassigned" || !p.manager_name).length;
    return {
      totalUsers: usersList.length,
      activeUsers,
      totalPrograms: programsList.length,
      totalProjects: projectsList.length,
      unassignedProjects,
    };
  }, [usersList, programsList, projectsList]);

  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
          <ShieldCheck size={36} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-md mt-1 mb-6">
          The Admin Console is strictly reserved for the System Administrator account.
        </p>
        <Link href="/dashboard" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-all">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md flex items-center gap-1">
              <ShieldCheck size={12} /> Master Administration
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Admin Console</h1>
          <p className="text-sm text-slate-500">
            Create and manage team members, programs, deliverables, and resource allocations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchData()}
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => {
              setFormError("");
              setIsAddUserOpen(true);
            }}
            className="flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl font-semibold text-xs shadow-sm cursor-pointer"
          >
            <UserPlus size={14} className="text-indigo-600" /> Add Member
          </button>
          <button
            onClick={() => {
              setFormError("");
              setIsAddProgramOpen(true);
            }}
            className="flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl font-semibold text-xs shadow-sm cursor-pointer"
          >
            <Layers size={14} className="text-indigo-600" /> Add Program
          </button>
          <button
            onClick={() => {
              setFormError("");
              setIsAddProjectOpen(true);
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-sm shadow-indigo-200 cursor-pointer"
          >
            <Plus size={14} /> Add Project
          </button>
        </div>
      </div>

      {/* ── Metric Highlights ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab("members")}
          className={`cursor-pointer bg-white border rounded-2xl p-4 shadow-sm transition-all hover:border-indigo-300 ${
            activeTab === "members" ? "ring-2 ring-indigo-500/20 border-indigo-500" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Members</span>
            <Users size={16} className="text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalUsers}</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">{stats.activeUsers} active accounts</p>
        </div>

        <div
          onClick={() => setActiveTab("programs")}
          className={`cursor-pointer bg-white border rounded-2xl p-4 shadow-sm transition-all hover:border-indigo-300 ${
            activeTab === "programs" ? "ring-2 ring-indigo-500/20 border-indigo-500" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Programs</span>
            <Layers size={16} className="text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalPrograms}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Active strategic umbrellas</p>
        </div>

        <div
          onClick={() => setActiveTab("projects")}
          className={`cursor-pointer bg-white border rounded-2xl p-4 shadow-sm transition-all hover:border-indigo-300 ${
            activeTab === "projects" ? "ring-2 ring-indigo-500/20 border-indigo-500" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">All Projects</span>
            <FolderKanban size={16} className="text-violet-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalProjects}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Autonomous & client initiatives</p>
        </div>

        <div
          onClick={() => setActiveTab("projects")}
          className="cursor-pointer bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 shadow-sm transition-all hover:border-amber-400"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Unassigned</span>
            <UserCheck size={16} className="text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-900 mt-1">{stats.unassignedProjects}</p>
          <p className="text-[11px] text-amber-700 font-semibold mt-0.5">Projects ready for member lead</p>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { key: "overview", label: "Overview & Quick Actions", icon: Sparkles },
          { key: "members", label: `Members (${usersList.length})`, icon: Users },
          { key: "programs", label: `Programs (${programsList.length})`, icon: Layers },
          { key: "projects", label: `Projects (${projectsList.length})`, icon: FolderKanban },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === t.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════ TAB: OVERVIEW ════════════════ */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" /> Administrative Actions
            </h3>
            <p className="text-xs text-slate-500">Fast track setup for new resources and programs.</p>
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => { setFormError(""); setIsAddUserOpen(true); }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <UserPlus size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Add New Team Member</p>
                    <p className="text-[10px] text-slate-400">Onboard engineer, researcher, or manager</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-600" />
              </button>

              <button
                onClick={() => { setFormError(""); setIsAddProgramOpen(true); }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Layers size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Create Program</p>
                    <p className="text-[10px] text-slate-400">Establish high-level strategic umbrella</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-600" />
              </button>

              <button
                onClick={() => { setFormError(""); setIsAddProjectOpen(true); }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50/20 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                    <FolderKanban size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Add New Project</p>
                    <p className="text-[10px] text-slate-400">Create project and assign team lead</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-violet-600" />
              </button>
            </div>
          </div>

          {/* Unassigned Projects Attention Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck size={16} className="text-amber-500" /> Unassigned Projects Requiring Lead
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Projects currently without an active assignee.</p>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                {stats.unassignedProjects} Unassigned
              </span>
            </div>

            <div className="space-y-2">
              {projectsList.filter(p => p.status === "Unassigned" || !p.manager_name).length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">All projects are assigned to active team members!</p>
              ) : (
                projectsList.filter(p => p.status === "Unassigned" || !p.manager_name).slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{p.name}</h4>
                      <p className="text-[10px] text-slate-400">{p.domain || "Deliverable"} • {p.priority} Priority</p>
                    </div>
                    <button
                      onClick={() => {
                        setProjectToAssign(p);
                        setSelectedAssigneeId("");
                        setIsAssignProjectOpen(true);
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <UserCheck size={12} /> Assign Member
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ TAB: MEMBERS ════════════════ */}
      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search member by name, email, title..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
              >
                <option value="all">All Roles</option>
                <option value="Worker">Worker</option>
                <option value="Member">Member</option>
                <option value="Task Manager">Task Manager</option>
                <option value="Project Manager">Project Manager</option>
                <option value="Executive Manager">Executive Manager</option>
                <option value="System Administrator">System Administrator</option>
              </select>
              <button
                onClick={() => { setFormError(""); setIsAddUserOpen(true); }}
                className="flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl shadow-sm cursor-pointer"
              >
                <Plus size={13} /> Add Member
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-5">Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Job Title</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Remarks & Profile</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                      No members matched criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold flex items-center justify-center text-xs">
                            {getInitials(u.full_name)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{u.full_name}</p>
                            <p className="text-[10px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          u.role === "Project Manager" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                          u.role === "Task Manager" ? "bg-cyan-50 text-cyan-700 border-cyan-200" :
                          u.role === "Executive Manager" ? "bg-purple-50 text-purple-700 border-purple-200" :
                          u.role === "System Administrator" ? "bg-rose-50 text-rose-700 border-rose-200" :
                          u.role === "Worker" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 font-medium">
                        {u.job_title || "Specialist"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 max-w-xs">
                          <button
                            onClick={() => openProfileModal(u)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 transition-all flex-shrink-0 cursor-pointer shadow-2xs"
                            title="View Profile and Add/Edit Remarks"
                          >
                            <FileText size={12} />
                            <span>Remarks</span>
                          </button>
                          <div 
                            onClick={() => openProfileModal(u)}
                            className="text-xs text-slate-600 truncate cursor-pointer hover:text-indigo-600 italic max-w-[170px]"
                            title={u.remarks || "No remarks added yet. Click to view profile and add remarks."}
                          >
                            {u.remarks ? `"${u.remarks}"` : <span className="text-slate-300 not-italic text-[11px]">No remarks</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openProfileModal(u)}
                          title="View Full Profile & Remarks"
                          className="text-slate-500 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          title="Delete Member"
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════ TAB: PROGRAMS ════════════════ */}
      {activeTab === "programs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Registered Programs</h3>
            <button
              onClick={() => { setFormError(""); setIsAddProgramOpen(true); }}
              className="flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl shadow-sm cursor-pointer"
            >
              <Plus size={13} /> Add Program
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programsList.map(prog => (
              <div key={prog.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm hover:border-indigo-300 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                      {prog.code || "PROG"}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-1.5">{prog.name}</h4>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">{prog.priority || "Medium"}</span>
                </div>
                {prog.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{prog.description}</p>
                )}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-50">
                  <span>Domain: <strong className="text-slate-700">{prog.domain || "AI"}</strong></span>
                  <div className="flex items-center gap-2">
                    <Link href="/programs" className="text-indigo-600 font-bold hover:underline flex items-center gap-1">
                      Manage <ExternalLink size={11} />
                    </Link>
                    <button
                      onClick={() => handleDeleteProgram(prog)}
                      title="Delete Program"
                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════ TAB: PROJECTS ════════════════ */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>
            <button
              onClick={() => { setFormError(""); setIsAddProjectOpen(true); }}
              className="flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl shadow-sm cursor-pointer"
            >
              <Plus size={13} /> Add Project
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-5">Project Name</th>
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Lead / Assignee</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map(p => {
                  const isUnassigned = p.status === "Unassigned" || !p.manager_name;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-5">
                        <Link href={`/projects/${p.id}`} className="text-xs font-bold text-slate-900 hover:text-indigo-600">
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">{p.domain || "General"}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          isUnassigned ? "bg-amber-50 text-amber-700 border-amber-200" :
                          p.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}>
                          {isUnassigned ? "Unassigned" : p.status || "In Progress"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                        {p.manager_name || <span className="text-amber-600 font-bold">Unassigned</span>}
                      </td>
                      <td className="py-3 px-4 text-xs font-bold text-slate-800">
                        {p.progress || 0}%
                      </td>
                      <td className="py-3 px-4 text-right flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setProjectToAssign(p);
                            setSelectedAssigneeId("");
                            setIsAssignProjectOpen(true);
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200/60 cursor-pointer"
                        >
                          {isUnassigned ? "Assign Member" : "Reassign"}
                        </button>
                        <button
                          onClick={() => handleDeleteProject(p)}
                          title="Delete Project"
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════ MODAL: ADD MEMBER ════════════════ */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Team Member</h3>
                <p className="text-xs text-slate-500 mt-0.5">Create user login credentials</p>
              </div>
              <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Full Name *</label>
                <input
                  value={userForm.fullName}
                  onChange={e => setUserForm({ ...userForm, fullName: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="john@argplatform.com"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Password *</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Min 6 characters"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Role *</label>
                  <select
                    value={userForm.role}
                    onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="Worker">Worker</option>
                    <option value="Member">Member</option>
                    <option value="Task Manager">Task Manager</option>
                    <option value="Project Manager">Project Manager</option>
                    <option value="Executive Manager">Executive Manager</option>
                    <option value="System Administrator">System Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Job Title</label>
                  <input
                    value={userForm.jobTitle}
                    onChange={e => setUserForm({ ...userForm, jobTitle: e.target.value })}
                    placeholder="e.g. AI Engineer"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Creating..." : "Create Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════ MODAL: ADD PROGRAM ════════════════ */}
      {isAddProgramOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add New Program</h3>
                <p className="text-xs text-slate-500 mt-0.5">Strategic delivery portfolio</p>
              </div>
              <button onClick={() => setIsAddProgramOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProgram} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Program Name *</label>
                <input
                  value={programForm.name}
                  onChange={e => setProgramForm({ ...programForm, name: e.target.value })}
                  placeholder="e.g. Autonomous Robotic Logistics"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Code</label>
                  <input
                    value={programForm.code}
                    onChange={e => setProgramForm({ ...programForm, code: e.target.value })}
                    placeholder="e.g. ARLP"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Domain</label>
                  <input
                    value={programForm.domain}
                    onChange={e => setProgramForm({ ...programForm, domain: e.target.value })}
                    placeholder="e.g. Robotics & AI"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={programForm.description}
                  onChange={e => setProgramForm({ ...programForm, description: e.target.value })}
                  placeholder="Objectives and scope..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddProgramOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Creating..." : "Create Program"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════ MODAL: ADD PROJECT ════════════════ */}
      {isAddProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add New Project</h3>
                <p className="text-xs text-slate-500 mt-0.5">Register deliverable and assign lead</p>
              </div>
              <button onClick={() => setIsAddProjectOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Project Name *</label>
                <input
                  value={projectForm.name}
                  onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                  placeholder="e.g. Vision Inspection Neural Net"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Parent Program</label>
                  <select
                    value={projectForm.programId}
                    onChange={e => setProjectForm({ ...projectForm, programId: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="">No program (Standalone)</option>
                    {programsList.map(prog => (
                      <option key={prog.id} value={prog.id}>{prog.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Domain</label>
                  <input
                    value={projectForm.domain}
                    onChange={e => setProjectForm({ ...projectForm, domain: e.target.value })}
                    placeholder="e.g. Computer Vision"
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Assign Lead Member</label>
                <select
                  value={projectForm.assigneeId}
                  onChange={e => setProjectForm({ ...projectForm, assigneeId: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="">Leave Unassigned</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={projectForm.aboutDescription}
                  onChange={e => setProjectForm({ ...projectForm, aboutDescription: e.target.value })}
                  placeholder="Deliverable context..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddProjectOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════ MODAL: ASSIGN PROJECT ════════════════ */}
      {isAssignProjectOpen && projectToAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Assign Project Lead</h3>
                <p className="text-xs text-slate-500 mt-0.5">{projectToAssign.name}</p>
              </div>
              <button onClick={() => setIsAssignProjectOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignProject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Select Team Member *
                </label>
                <select
                  value={selectedAssigneeId}
                  onChange={e => setSelectedAssigneeId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-indigo-500 bg-white"
                  required
                >
                  <option value="">Choose a member...</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Assigning a member will set project status to In Progress and register them as project lead.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignProjectOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedAssigneeId}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? "Assigning..." : <><UserCheck size={13} /> Confirm Assignment</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MEMBER PROFILE & REMARKS MODAL ---------------- */}
      {selectedProfileUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white flex-shrink-0">
              <button
                onClick={() => setSelectedProfileUser(null)}
                className="absolute right-5 top-5 p-1.5 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg border-2 border-white/20 flex-shrink-0">
                  {getInitials(selectedProfileUser.full_name)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold tracking-tight truncate">{selectedProfileUser.full_name}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/15 text-indigo-200 border border-white/10">
                      {selectedProfileUser.role}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      selectedProfileUser.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-300"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedProfileUser.is_active ? "bg-emerald-400" : "bg-slate-400"}`} />
                      {selectedProfileUser.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/80 font-medium mt-0.5">{selectedProfileUser.job_title || "Specialist"}</p>
                  <p className="text-[11px] text-white/50 mt-0.5 truncate">{selectedProfileUser.email}</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Quick KPI stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-center">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tasks</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">
                    {selectedProfileUser.taskStats?.total ?? (selectedProfileUser.tasks?.length || 0)}
                  </p>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-2xl p-3.5 text-center">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Completed</p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">
                    {selectedProfileUser.taskStats?.completed ?? 0}
                  </p>
                </div>
                <div className="bg-blue-50/60 border border-blue-200/70 rounded-2xl p-3.5 text-center">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">In Progress</p>
                  <p className="text-xl font-bold text-blue-700 mt-0.5">
                    {selectedProfileUser.taskStats?.in_progress ?? 0}
                  </p>
                </div>
                <div className="bg-purple-50/60 border border-purple-200/70 rounded-2xl p-3.5 text-center">
                  <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Projects</p>
                  <p className="text-xl font-bold text-purple-700 mt-0.5">
                    {selectedProfileUser.projects?.length || 0}
                  </p>
                </div>
              </div>

              {/* Remarks Section */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-indigo-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Remarks & Evaluations</h3>
                      <p className="text-[11px] text-slate-500">Record remarks, feedback, or performance notes for this member.</p>
                    </div>
                  </div>
                  {remarksSuccess && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full animate-in fade-in">
                      <Check size={12} /> Remarks Saved!
                    </span>
                  )}
                </div>

                <textarea
                  rows={3}
                  value={userRemarksText}
                  onChange={e => setUserRemarksText(e.target.value)}
                  placeholder="Enter remarks about this member (e.g. 'Strong in AI RAG pipeline, proactive in sprint deliverables, recommended for team lead')..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y placeholder:text-slate-400 font-medium"
                />

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] text-slate-400 font-medium">
                    Remarks are visible to management and persist in the database.
                  </p>
                  <button
                    onClick={handleSaveRemarks}
                    disabled={savingRemarks}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm shadow-indigo-200 transition-all cursor-pointer"
                  >
                    {savingRemarks ? (
                      <>
                        <div className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check size={13} />
                        Save Remarks
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Assigned Projects */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <FolderKanban size={15} className="text-slate-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Assigned Projects ({selectedProfileUser.projects?.length || 0})
                  </h3>
                </div>

                {loadingProfile ? (
                  <div className="py-6 text-center text-xs text-slate-400">Loading projects & tasks...</div>
                ) : !selectedProfileUser.projects || selectedProfileUser.projects.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                    Not currently assigned to any active project.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedProfileUser.projects.map((proj: any) => (
                      <div key={proj.id} className="p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-900 truncate">{proj.name}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {proj.project_role || "Member"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{proj.domain || "General"}</span>
                          <span>�</span>
                          <span className="font-semibold text-slate-600">{proj.status || "Active"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assigned Tasks */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <CheckCircle2 size={15} className="text-slate-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Assigned Tasks ({selectedProfileUser.tasks?.length || 0})
                  </h3>
                </div>

                {!selectedProfileUser.tasks || selectedProfileUser.tasks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                    No tasks currently assigned to this member.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedProfileUser.tasks.slice(0, 10).map((tsk: any) => (
                      <div key={tsk.id} className="flex items-center justify-between p-2.5 bg-slate-50/70 border border-slate-200/70 rounded-xl text-xs gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{tsk.name || tsk.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">{tsk.project_name || "Project"}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            tsk.status === "Completed" || tsk.status === "Done"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : tsk.status === "In Progress"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}>
                            {tsk.status === "Done" ? "Completed" : tsk.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end flex-shrink-0">
              <button
                onClick={() => setSelectedProfileUser(null)}
                className="px-5 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
