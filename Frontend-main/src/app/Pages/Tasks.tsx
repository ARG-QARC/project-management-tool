"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Plus, Search, X, Calendar, AlertCircle, CheckCircle2, Circle,
  LayoutGrid, List, Clock, ChevronRight, Filter, Paperclip,
  Upload, Trash2, ExternalLink, Download, FileText, Check,
  AlertTriangle, User, MessageSquare, Eye, ChevronDown, Flag,
  Briefcase, ArrowRight, ShieldCheck, MoreVertical, RefreshCw, Layers,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useProgram } from "@/context/ProgramContext";
import { API_BASE } from "@/lib/api";

type TaskStatus = "To Do" | "In Progress" | "Completed";
type Priority = "Low" | "Medium" | "High";

type Task = {
  id: string;
  name: string;
  title?: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  project_id: string;
  project_name?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_email?: string;
  start_date?: string;
  due_date?: string;
  created_at?: string;
  work_parts_count?: number;
  submissions_count?: number;
  attachments_count?: number;
  challenges_count?: number;
};

type Project = {
  id: string;
  name: string;
  domain?: string;
  status?: string;
};

type TeamMember = {
  id: string;
  full_name: string;
  email?: string;
  role?: string;
};

type WorkPart = {
  id: string;
  task_id: string;
  title: string;
  description?: string;
  status: "To Do" | "Pending" | "Done";
  creator_name?: string;
  created_at?: string;
};

type Submission = {
  id: string;
  task_id: string;
  link?: string;
  description?: string;
  version: number;
  submitter_name?: string;
  created_at: string;
};

type Attachment = {
  id: string;
  task_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploader_name?: string;
  created_at: string;
};

type Challenge = {
  id: string;
  task_id: string;
  challenge: string;
  status: string;
  creator_name?: string;
  created_at: string;
};

const STATUSES: TaskStatus[] = ["To Do", "In Progress", "Completed"];

const STATUS_CONFIG: Record<TaskStatus, { badge: string; dot: string; border: string; icon: React.ElementType }> = {
  "To Do": {
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    border: "border-slate-200",
    icon: Circle
  },
  "In Progress": {
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    border: "border-blue-200",
    icon: Clock
  },
  "Completed": {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
    icon: CheckCircle2
  },
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function daysUntil(date?: string) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function getInitial(name?: string) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function Tasks() {
  const router = useRouter();
  const { user } = useAuth();
  const roleLower = (user?.role || "").toLowerCase();
  const isManager =
    roleLower.includes("manager") ||
    roleLower.includes("administrator") ||
    roleLower.includes("admin") ||
    roleLower.includes("lead");
  const { selectedProgram, getProjectProgram } = useProgram();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Create / Edit Task Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState<"create" | "edit">("create");
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [taskForm, setTaskForm] = useState({
    name: "",
    description: "",
    projectId: "",
    assigneeId: "",
    priority: "Medium" as Priority,
    status: "To Do" as TaskStatus,
    startDate: "",
    dueDate: "",
  });
  const [initialFile, setInitialFile] = useState<File | null>(null);

  // Task Drawer / Details State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "workparts" | "submissions" | "attachments" | "challenges">("overview");

  // Drawer Sub-data
  const [workParts, setWorkParts] = useState<WorkPart[]>([]);
  const [loadingWorkParts, setLoadingWorkParts] = useState(false);
  const [newPartTitle, setNewPartTitle] = useState("");
  const [newPartDesc, setNewPartDesc] = useState("");

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [subLink, setSubLink] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [savingSub, setSavingSub] = useState(false);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [newChallenge, setNewChallenge] = useState("");
  const [savingChallenge, setSavingChallenge] = useState(false);

  const getHeaders = (): HeadersInit => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const getAuthOnlyHeader = (): HeadersInit => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getHeaders();
      const [projRes, membersRes] = await Promise.all([
        fetch(`${API_BASE}/projects`, { headers }).catch(() => null),
        fetch(`${API_BASE}/teams/members`, { headers }).catch(() => null),
      ]);

      let loadedProjects: Project[] = [];
      if (projRes?.ok) {
        const projData = await projRes.json();
        loadedProjects = projData.projects || projData.data || [];
        setProjects(loadedProjects);
      }

      if (membersRes?.ok) {
        const md = await membersRes.json();
        let loadedMembers: TeamMember[] = Array.isArray(md) ? md : (md.members || md.data || md.users || []);
        if (loadedMembers.length === 0) {
          const fallbackRes = await fetch(`${API_BASE}/programs/assignable-users`, { headers }).catch(() => null);
          if (fallbackRes?.ok) {
            const fd = await fallbackRes.json();
            loadedMembers = fd.users || [];
          }
        }
        setMembers(loadedMembers);
      } else {
        const fallbackRes = await fetch(`${API_BASE}/programs/assignable-users`, { headers }).catch(() => null);
        if (fallbackRes?.ok) {
          const fd = await fallbackRes.json();
          setMembers(fd.users || []);
        }
      }

      let allTasks: Task[] = [];

      if (isManager) {
        const res = await fetch(`${API_BASE}/tasks`, { headers }).catch(() => null);
        if (res && res.ok) {
          const d = await res.json();
          allTasks = (d.tasks || d.data || []).map((t: any) => ({
            id: String(t.id),
            name: t.name || t.title || "Untitled Task",
            description: t.description || "",
            status: (t.status || "To Do") as TaskStatus,
            priority: (t.priority || "Medium") as Priority,
            project_id: t.project_id ? String(t.project_id) : undefined,
            project_name: t.project_name || "Program Tasks (Individual)",
            assignee_id: t.assignee_id ? String(t.assignee_id) : undefined,
            assignee_name: t.assignee_name || t.assignee?.full_name || undefined,
            assignee_email: t.assignee_email || t.assignee?.email || undefined,
            start_date: t.start_date || t.startDate || "",
            due_date: t.due_date || t.dueDate || "",
            created_at: t.created_at || t.createdAt || "",
          }));
        } else {
          const arrays = await Promise.all(
            loadedProjects.map(async (p) => {
              const pRes = await fetch(`${API_BASE}/tasks/project/${p.id}`, { headers }).catch(() => null);
              if (!pRes || !pRes.ok) return [];
              const d = await pRes.json();
              return (d.tasks || d.data || []).map((t: any) => ({
                id: String(t.id),
                name: t.name || t.title || "Untitled Task",
                description: t.description || "",
                status: (t.status || "To Do") as TaskStatus,
                priority: (t.priority || "Medium") as Priority,
                project_id: String(p.id),
                project_name: p.name,
                assignee_id: t.assignee_id ? String(t.assignee_id) : undefined,
                assignee_name: t.assignee_name || t.assignee?.full_name || undefined,
                assignee_email: t.assignee_email || t.assignee?.email || undefined,
                start_date: t.start_date || t.startDate || "",
                due_date: t.due_date || t.dueDate || "",
                created_at: t.created_at || t.createdAt || "",
              }));
            })
          );
          allTasks = arrays.flat();
        }
      } else {
        const res = await fetch(`${API_BASE}/tasks/my/tasks`, { headers }).catch(() => null);
        if (res && res.ok) {
          const d = await res.json();
          allTasks = (d.tasks || d.data || []).map((t: any) => ({
            id: String(t.id),
            name: t.name || t.title || "Untitled Task",
            description: t.description || "",
            status: (t.status || "To Do") as TaskStatus,
            priority: (t.priority || "Medium") as Priority,
            project_id: String(t.project_id || t.projectId || ""),
            project_name: t.project_name || t.project?.name || "Project",
            assignee_id: t.assignee_id ? String(t.assignee_id) : undefined,
            assignee_name: t.assignee_name || t.assignee?.full_name || undefined,
            assignee_email: t.assignee_email || t.assignee?.email || undefined,
            start_date: t.start_date || t.startDate || "",
            due_date: t.due_date || t.dueDate || "",
            created_at: t.created_at || t.createdAt || "",
          }));
        }
      }

      setTasks(allTasks);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Handle drawer data fetching when selectedTask changes
  useEffect(() => {
    if (!selectedTask) return;
    fetchWorkParts(selectedTask.id);
    fetchSubmissions(selectedTask.id);
    fetchAttachments(selectedTask.id);
    fetchChallenges(selectedTask.id);
  }, [selectedTask]);

  const fetchWorkParts = async (taskId: string) => {
    setLoadingWorkParts(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/work-parts`, { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setWorkParts(d.workParts || d.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWorkParts(false);
    }
  };

  const fetchSubmissions = async (taskId: string) => {
    setLoadingSubmissions(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/submissions`, { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setSubmissions(d.submissions || d.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const fetchAttachments = async (taskId: string) => {
    setLoadingAttachments(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/attachments`, { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setAttachments(d.attachments || d.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const fetchChallenges = async (taskId: string) => {
    setLoadingChallenges(true);
    try {
      const res = await fetch(`${API_BASE}/challenges/task/${taskId}`, { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setChallenges(d.challenges || d.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChallenges(false);
    }
  };

  // Status Change Logic adhering strictly to backend business rules
  const handleUpdateStatus = async (taskId: string, targetStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const endpoint = `${API_BASE}/tasks/${taskId}/status`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to update task status");
      }

      // Optimistic/Live update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetStatus } : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, status: targetStatus } : null);
      }
    } catch (err: any) {
      alert(err.message || "Status change was rejected by server.");
      fetchData();
    }
  };

  // Reassign Task
  const handleReassignTask = async (taskId: string, assigneeId: string) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/assign`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ assigneeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to reassign task");
      }
      const assignedMember = members.find(m => m.id === assigneeId);
      setTasks(prev => prev.map(t => t.id === taskId ? {
        ...t,
        assignee_id: assigneeId,
        assignee_name: assignedMember?.full_name || t.assignee_name,
        assignee_email: assignedMember?.email || t.assignee_email
      } : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? {
          ...prev,
          assignee_id: assigneeId,
          assignee_name: assignedMember?.full_name || prev.assignee_name,
          assignee_email: assignedMember?.email || prev.assignee_email
        } : null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to assign task.");
    }
  };

  // Create / Edit Task Submit
  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.name.trim()) {
      setCreateError("Task title is required");
      return;
    }
    const effectiveProjectId = (taskForm.projectId && taskForm.projectId !== "standalone") ? taskForm.projectId : null;

    setCreating(true);
    setCreateError("");

    try {
      let endpoint = effectiveProjectId
        ? `${API_BASE}/tasks/project/${effectiveProjectId}`
        : `${API_BASE}/tasks`;
      let method = "POST";
      
      if (taskModalMode === "edit" && editTaskId) {
        endpoint = `${API_BASE}/tasks/${editTaskId}`;
        method = "PATCH";
      }

      const res = await fetch(endpoint, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          name: taskForm.name.trim(),
          description: taskForm.description.trim() || null,
          status: taskForm.status,
          priority: taskForm.priority,
          assigneeId: taskForm.assigneeId || null,
          projectId: effectiveProjectId,
          projectManagerId: user?.id,
          startDate: taskForm.startDate || null,
          dueDate: taskForm.dueDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || `Failed to ${taskModalMode} task`);

      const createdId = data.task?.id || data.id || data.data?.id;

      // If initial file was attached, upload it
      if (initialFile && createdId && taskModalMode === "create") {
        const formData = new FormData();
        formData.append("file", initialFile);
        await fetch(`${API_BASE}/tasks/${createdId}/attachments`, {
          method: "POST",
          headers: getAuthOnlyHeader(),
          body: formData,
        }).catch(err => console.error("Attachment upload error", err));
      }

      setIsTaskModalOpen(false);
      setTaskForm({
        name: "",
        description: "",
        projectId: "",
        assigneeId: "",
        priority: "Medium",
        status: "To Do",
        startDate: "",
        dueDate: "",
      });
      setInitialFile(null);
      
      // Update selectedTask if editing
      if (taskModalMode === "edit" && selectedTask?.id === editTaskId) {
        setSelectedTask(prev => prev ? {
           ...prev,
           name: taskForm.name.trim(),
           description: taskForm.description.trim(),
           status: taskForm.status,
           priority: taskForm.priority,
           assignee_id: taskForm.assigneeId,
           due_date: taskForm.dueDate
        } : null);
      }
      
      fetchData();
    } catch (err: any) {
      setCreateError(err.message || `Error ${taskModalMode === 'edit' ? 'updating' : 'creating'} task`);
    } finally {
      setCreating(false);
    }
  };

  // Work Part Add
  const handleAddWorkPart = async () => {
    if (!selectedTask || !newPartTitle.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/tasks/${selectedTask.id}/work-parts`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          title: newPartTitle.trim(),
          description: newPartDesc.trim() || null,
          status: "To Do",
        }),
      });
      if (res.ok) {
        setNewPartTitle("");
        setNewPartDesc("");
        fetchWorkParts(selectedTask.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Work Part Status Toggle
  const handleToggleWorkPart = async (part: WorkPart) => {
    if (!selectedTask) return;
    const nextStatus = part.status === "Done" ? "To Do" : "Done";
    try {
      const res = await fetch(`${API_BASE}/work-parts/${part.id}/status`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchWorkParts(selectedTask.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Work Part Delete
  const handleDeleteWorkPart = async (partId: string) => {
    if (!selectedTask) return;
    try {
      const res = await fetch(`${API_BASE}/work-parts/${partId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        fetchWorkParts(selectedTask.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Submissions Add
  const handleAddSubmission = async () => {
    if (!selectedTask) return;
    setSavingSub(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/${selectedTask.id}/submissions`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          link: subLink.trim() || null,
          description: subDesc.trim() || null,
        }),
      });
      if (res.ok) {
        setSubLink("");
        setSubDesc("");
        fetchSubmissions(selectedTask.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingSub(false);
    }
  };

  // Attachment Upload from Drawer
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/tasks/${selectedTask.id}/attachments`, {
        method: "POST",
        headers: getAuthOnlyHeader(),
        body: formData,
      });
      if (res.ok) {
        fetchAttachments(selectedTask.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  // Attachment Delete
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedTask) return;
    if (!confirm("Are you sure you want to delete this attachment?")) return;
    try {
      const res = await fetch(`${API_BASE}/attachments/${attachmentId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        fetchAttachments(selectedTask.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Challenges Add
  const handleAddChallenge = async () => {
    if (!selectedTask || !newChallenge.trim()) return;
    setSavingChallenge(true);
    try {
      const res = await fetch(`${API_BASE}/challenges/task/${selectedTask.id}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ challenge: newChallenge.trim() }),
      });
      if (res.ok) {
        setNewChallenge("");
        fetchChallenges(selectedTask.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingChallenge(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Permanently delete this task?")) return;
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        if (selectedTask?.id === taskId) setSelectedTask(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Program scope check
      if (selectedProgram) {
        const associatedProject = projects.find(p => p.id === t.project_id) || { name: t.project_name };
        const prog = getProjectProgram(associatedProject);
        if (prog.id !== selectedProgram.id) return false;
      }

      const q = search.toLowerCase();
      const matchesSearch = !q ||
        t.name.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.project_name || "").toLowerCase().includes(q) ||
        (t.assignee_name || "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesProject = projectFilter === "all" || t.project_id === projectFilter;
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesProject && matchesPriority;
    });
  }, [tasks, projects, search, statusFilter, projectFilter, priorityFilter, selectedProgram, getProjectProgram]);

  // Overall Task Statistics
  const taskStats = useMemo(() => {
    const baseTasks = selectedProgram
      ? tasks.filter(t => {
          const associatedProject = projects.find(p => p.id === t.project_id) || { name: t.project_name };
          return getProjectProgram(associatedProject).id === selectedProgram.id;
        })
      : tasks;

    return {
      total: baseTasks.length,
      todo: baseTasks.filter(t => t.status === "To Do").length,
      inProgress: baseTasks.filter(t => t.status === "In Progress").length,
      completed: baseTasks.filter(t => t.status === "Completed" || (t.status as any) === "Done").length,
      done: baseTasks.filter(t => t.status === "Completed" || (t.status as any) === "Done").length,
      overdue: baseTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "Completed" && (t.status as any) !== "Done").length,
    };
  }, [tasks, projects, selectedProgram, getProjectProgram]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading project tasks...</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* ── Top Header & Action Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
              Workflow & Execution
            </p>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Tasks Board</h1>
          <p className="text-sm text-slate-500">
            Track deliverables, assign work parts, review submissions, and manage blockers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            title="Refresh tasks"
          >
            <RefreshCw size={16} />
          </button>
          <div className="flex items-center bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
            <button
              onClick={() => setView("board")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === "board" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid size={14} /> Kanban
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === "list" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <List size={14} /> List
            </button>
          </div>
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm shadow-indigo-200 transition-all"
          >
            <Plus size={16} /> New Task
          </button>
        </div>
      </div>

      {/* ── Status Metrics Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Total Tasks</span>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{taskStats.total}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-xs font-semibold text-slate-600">To Do</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-0.5">{taskStats.todo}</p>
        </div>
        <div className="bg-white border border-blue-200/80 bg-blue-50/20 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold text-blue-700">In Progress</span>
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-0.5">{taskStats.inProgress}</p>
        </div>
        <div className="bg-white border border-emerald-200/80 bg-emerald-50/20 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">Completed</span>
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-0.5">{taskStats.completed}</p>
        </div>
      </div>

      {/* ── Toolbar & Multi-Filters ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, description, project, assignee..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── KANBAN BOARD VIEW ── */}
      {view === "board" && (
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-6 px-6 lg:-mx-8 lg:px-8 min-h-[620px] items-start">
          {STATUSES.map(colStatus => {
            const colTasks = filteredTasks.filter(t => t.status === colStatus || (colStatus === "Completed" && (t.status as any) === "Done"));
            const conf = STATUS_CONFIG[colStatus] || STATUS_CONFIG["Completed"];

            return (
              <div key={colStatus} className="flex-1 min-w-[300px] max-w-[380px] bg-slate-50/75 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col max-h-[820px]">
                {/* Column Title */}
                <div className="flex items-center justify-between px-1.5 py-1 mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${conf.dot}`} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{colStatus}</h3>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                  {colTasks.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                      <p className="text-xs font-medium">No tasks in {colStatus}</p>
                    </div>
                  ) : (
                    colTasks.map(task => {
                      const days = daysUntil(task.due_date);
                      const isLate = days !== null && days < 0 && task.status !== "Completed" && (task.status as any) !== "Done";

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all p-4 cursor-pointer group flex flex-col gap-2.5"
                        >
                          {/* Project & Quick Status Dropdown */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 truncate max-w-[170px]">
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded truncate">
                                {getProjectProgram({ name: task.project_name }).code || "PRG"}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate">
                                {task.project_name || "General"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                              <select
                                value={task.status}
                                onChange={e => handleUpdateStatus(task.id, e.target.value as TaskStatus)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border cursor-pointer ${conf.badge}`}
                              >
                                {STATUSES.map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Task Name */}
                          <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2">
                            {task.name}
                          </h4>

                          {/* Description preview */}
                          {task.description && (
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Footer: Due date & Assignee */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                            {task.due_date ? (
                              <div className={`flex items-center gap-1 text-[11px] font-semibold ${
                                isLate ? "text-rose-600" : days !== null && days <= 3 ? "text-amber-600" : "text-slate-400"
                              }`}>
                                <Calendar size={12} />
                                <span>{isLate ? `${Math.abs(days!)}d late` : days === 0 ? "Due today" : `${days}d left`}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-300">No deadline</span>
                            )}

                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                task.priority === "High" ? "bg-rose-50 text-rose-600" :
                                task.priority === "Medium" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                              }`}>
                                {task.priority}
                              </span>
                              <div
                                className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                                title={task.assignee_name || "Unassigned"}
                              >
                                {getInitial(task.assignee_name)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-5">Task Title</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      No tasks found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map(task => {
                    const conf = STATUS_CONFIG[task.status] || STATUS_CONFIG["Completed"];
                    const days = daysUntil(task.due_date);
                    const isLate = days !== null && days < 0 && task.status !== "Completed" && (task.status as any) !== "Done";

                    return (
                      <tr
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="hover:bg-slate-50/75 cursor-pointer transition-colors group"
                      >
                        <td className="py-3.5 px-5">
                          <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {task.name}
                          </p>
                          {task.description && (
                            <p className="text-xs text-slate-400 truncate max-w-sm">{task.description}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4" onClick={e => e.stopPropagation()}>
                          <select
                            value={task.status}
                            onChange={e => handleUpdateStatus(task.id, e.target.value as TaskStatus)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg border cursor-pointer outline-none ${conf.badge}`}
                          >
                            {STATUSES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            task.priority === "High" ? "bg-rose-50 text-rose-600" :
                            task.priority === "Medium" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                          }`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                          {task.project_name || "General"}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                              {getInitial(task.assignee_name)}
                            </div>
                            <span className="text-xs text-slate-700">{task.assignee_name || "Unassigned"}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {task.due_date ? (
                            <span className={`text-xs font-semibold ${isLate ? "text-rose-600" : days !== null && days <= 3 ? "text-amber-600" : "text-slate-500"}`}>
                              {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete Task"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TASK DETAIL SLIDE-OVER DRAWER ── */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                    {selectedTask.project_name || "Project"}
                  </span>
                  <select
                    value={selectedTask.status}
                    onChange={e => handleUpdateStatus(selectedTask.id, e.target.value as TaskStatus)}
                    className={`text-xs font-bold px-2 py-0.5 rounded-md border cursor-pointer ${(STATUS_CONFIG[selectedTask.status] || STATUS_CONFIG["Completed"]).badge}`}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    selectedTask.priority === "High" ? "bg-rose-50 text-rose-600" :
                    selectedTask.priority === "Medium" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                  }`}>
                    {selectedTask.priority} Priority
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 leading-snug">{selectedTask.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                {isManager && (
                  <button
                    onClick={() => {
                      setTaskModalMode("edit");
                      setEditTaskId(selectedTask.id);
                      setTaskForm({
                        name: selectedTask.name || "",
                        description: (selectedTask as any).description || "",
                        projectId: selectedTask.project_id || "",
                        assigneeId: selectedTask.assignee_id || "",
                        priority: (selectedTask.priority as Priority) || "Medium",
                        status: (selectedTask.status as TaskStatus) || "To Do",
                        startDate: "",
                        dueDate: selectedTask.due_date ? new Date(selectedTask.due_date).toISOString().split('T')[0] : "",
                      });
                      setIsTaskModalOpen(true);
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg shadow-sm"
                  >
                    Edit Task
                  </button>
                )}
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 px-5 text-xs font-bold bg-white">
              {[
                { key: "overview", label: "Overview" },
                { key: "workparts", label: `Work Parts (${workParts.length})` },
                { key: "submissions", label: `Deliverables (${submissions.length})` },
                { key: "attachments", label: `Files (${attachments.length})` },
                { key: "challenges", label: `Blockers (${challenges.length})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-3 px-3.5 border-b-2 transition-all capitalize ${
                    activeTab === tab.key
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Drawer Body Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Description</h3>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {selectedTask.description || "No description provided for this task."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Member</span>
                        {isManager && (
                          <span className="text-[10px] font-semibold text-indigo-600">Change</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                          {getInitial(selectedTask.assignee_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          {isManager ? (
                            <select
                              value={selectedTask.assignee_id || ""}
                              onChange={e => handleReassignTask(selectedTask.id, e.target.value)}
                              className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg p-1.5 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="">Unassigned</option>
                              {members.map(m => (
                                <option key={m.id} value={m.id}>{m.full_name}</option>
                              ))}
                            </select>
                          ) : (
                            <>
                              <p className="text-xs font-bold text-slate-800">{selectedTask.assignee_name || "Unassigned"}</p>
                              {selectedTask.assignee_email && (
                                <p className="text-[10px] text-slate-400 truncate">{selectedTask.assignee_email}</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Timeline</span>
                      <div className="mt-2 space-y-1 text-xs font-semibold text-slate-700">
                        <p>Start: <span className="font-normal text-slate-500">{selectedTask.start_date || "Immediate"}</span></p>
                        <p>Due: <span className="font-normal text-slate-500">{selectedTask.due_date || "No deadline"}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Summary Progress Cards */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Work Completion Health</span>
                      <span className="text-indigo-600">
                        {workParts.length > 0
                          ? `${Math.round((workParts.filter(p => p.status === "Done").length / workParts.length) * 100)}%`
                          : "No parts defined"}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all"
                        style={{
                          width: `${
                            workParts.length > 0
                              ? (workParts.filter(p => p.status === "Done").length / workParts.length) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: WORK PARTS */}
              {activeTab === "workparts" && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Add Work Part</h4>
                    <input
                      value={newPartTitle}
                      onChange={e => setNewPartTitle(e.target.value)}
                      placeholder="e.g. Implement authentication callback"
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <textarea
                      value={newPartDesc}
                      onChange={e => setNewPartDesc(e.target.value)}
                      placeholder="Optional details or specifications..."
                      rows={2}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                    />
                    <button
                      onClick={handleAddWorkPart}
                      disabled={!newPartTitle.trim()}
                      className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg disabled:opacity-50 transition-all"
                    >
                      Add Work Part
                    </button>
                  </div>

                  <div className="space-y-2">
                    {loadingWorkParts ? (
                      <p className="text-xs text-slate-400 py-4 text-center">Loading parts...</p>
                    ) : workParts.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">No work parts added yet.</p>
                    ) : (
                      workParts.map(part => (
                        <div
                          key={part.id}
                          className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all gap-3"
                        >
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <button
                              onClick={() => handleToggleWorkPart(part)}
                              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                part.status === "Done" ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300"
                              }`}
                            >
                              {part.status === "Done" && <Check size={11} />}
                            </button>
                            <div>
                              <p className={`text-xs font-semibold ${part.status === "Done" ? "line-through text-slate-400" : "text-slate-800"}`}>
                                {part.title}
                              </p>
                              {part.description && <p className="text-[11px] text-slate-400 mt-0.5">{part.description}</p>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteWorkPart(part.id)}
                            className="text-slate-300 hover:text-rose-600 p-1 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: DELIVERABLES & SUBMISSIONS */}
              {activeTab === "submissions" && (
                <div className="space-y-4">
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Submit Deliverable</h4>
                    <input
                      value={subLink}
                      onChange={e => setSubLink(e.target.value)}
                      placeholder="Proof link (e.g. GitHub PR, Figma, Drive link)"
                      className="w-full text-xs bg-white border border-emerald-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <textarea
                      value={subDesc}
                      onChange={e => setSubDesc(e.target.value)}
                      placeholder="Notes regarding what was completed..."
                      rows={2}
                      className="w-full text-xs bg-white border border-emerald-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                    />
                    <button
                      onClick={handleAddSubmission}
                      disabled={savingSub}
                      className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg disabled:opacity-50 transition-all"
                    >
                      {savingSub ? "Saving..." : "Submit Deliverable"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {loadingSubmissions ? (
                      <p className="text-xs text-slate-400 py-4 text-center">Loading submissions...</p>
                    ) : submissions.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">No submissions recorded yet.</p>
                    ) : (
                      submissions.map(sub => (
                        <div key={sub.id} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">Version {sub.version}</span>
                            <span className="text-slate-400">{new Date(sub.created_at).toLocaleDateString()}</span>
                          </div>
                          {sub.link && (
                            <a
                              href={sub.link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                            >
                              <ExternalLink size={12} /> {sub.link}
                            </a>
                          )}
                          {sub.description && (
                            <p className="text-xs text-slate-600 mt-1">{sub.description}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: ATTACHMENTS */}
              {activeTab === "attachments" && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors">
                    <label className="cursor-pointer flex flex-col items-center gap-2">
                      <Upload size={24} className="text-indigo-600" />
                      <span className="text-xs font-bold text-slate-700">Upload Task Attachment</span>
                      <span className="text-[10px] text-slate-400">PDF, PNG, JPG, ZIP up to 50MB</span>
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        disabled={uploadingFile}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    {loadingAttachments ? (
                      <p className="text-xs text-slate-400 py-4 text-center">Loading files...</p>
                    ) : attachments.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">No attachments for this task.</p>
                    ) : (
                      attachments.map(att => (
                        <div key={att.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl text-xs gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText size={16} className="text-indigo-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{att.file_name}</p>
                              <p className="text-[10px] text-slate-400">{formatBytes(att.file_size)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`${API_BASE}/attachments/${att.id}/preview`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-500 hover:text-indigo-600"
                              title="Preview"
                            >
                              <Eye size={14} />
                            </a>
                            <button
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: BLOCKERS & CHALLENGES */}
              {activeTab === "challenges" && (
                <div className="space-y-4">
                  <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">Report Impediment or Blocker</h4>
                    <textarea
                      value={newChallenge}
                      onChange={e => setNewChallenge(e.target.value)}
                      placeholder="Describe what is blocking this task..."
                      rows={2}
                      className="w-full text-xs bg-white border border-rose-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
                    />
                    <button
                      onClick={handleAddChallenge}
                      disabled={savingChallenge || !newChallenge.trim()}
                      className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-lg disabled:opacity-50 transition-all"
                    >
                      {savingChallenge ? "Reporting..." : "Report Blocker"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {loadingChallenges ? (
                      <p className="text-xs text-slate-400 py-4 text-center">Loading blockers...</p>
                    ) : challenges.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">No active blockers reported.</p>
                    ) : (
                      challenges.map(ch => (
                        <div key={ch.id} className="p-3 bg-white border border-rose-200 rounded-xl text-xs space-y-1">
                          <p className="font-semibold text-rose-900">{ch.challenge}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-50">
                            <span>Reported by {ch.creator_name || "Team Member"}</span>
                            <span>{new Date(ch.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE NEW TASK MODAL ── */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">{taskModalMode === "edit" ? "Edit Task" : "Create Task"}</h3>
                <p className="text-xs text-slate-500">{taskModalMode === "edit" ? "Modify existing task details" : "Add an action item to a project"}</p>
              </div>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTaskSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {createError && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} /> {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Task Name *
                </label>
                <input
                  required
                  value={taskForm.name}
                  onChange={e => setTaskForm({ ...taskForm, name: e.target.value })}
                  placeholder="e.g. Implement user activity stream"
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Project Scope
                </label>
                <select
                  value={taskForm.projectId}
                  onChange={e => setTaskForm({ ...taskForm, projectId: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                  <option value="standalone">Program Tasks (Individual / Standalone)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Assignee
                  </label>
                  <select
                    value={taskForm.assigneeId}
                    onChange={e => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}{m.role ? ` (${m.role})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Priority
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as Priority })}
                    className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={taskForm.startDate}
                    onChange={e => setTaskForm({ ...taskForm, startDate: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Task goals and expected deliverables..."
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Attach Initial File (Optional)
                </label>
                <input
                  type="file"
                  onChange={e => setInitialFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {creating ? (taskModalMode === "edit" ? "Saving..." : "Creating Task...") : (taskModalMode === "edit" ? "Save Changes" : "Create Task")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

