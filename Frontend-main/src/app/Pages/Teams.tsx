"use client";

import React, { useEffect, useState } from "react";
import { Users, Mail, Shield, Briefcase, FileText, X, Check, FolderKanban, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";

type Member = { id: string; full_name: string; email?: string; role: string; team_name?: string; remarks?: string; projects?: any[]; tasks?: any[]; taskStats?: any; job_title?: string };

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

const ROLE_COLORS: Record<string, string> = {
  "Project Manager": "bg-blue-50 text-blue-700 border-blue-200",
  "Task Manager": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Developer": "bg-violet-50 text-violet-700 border-violet-200",
  "Designer": "bg-pink-50 text-pink-700 border-pink-200",
  "QA Engineer": "bg-amber-50 text-amber-700 border-amber-200",
  "System Administrator": "bg-rose-50 text-rose-700 border-rose-200",
  "Executive Manager": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Worker": "bg-amber-50 text-amber-700 border-amber-200",
  "Member": "bg-slate-100 text-slate-700 border-slate-200",
};

function roleColor(role: string) {
  return ROLE_COLORS[role] || "bg-gray-100 text-gray-600 border-gray-200";
}

function avatarGradient(name: string) {
  const gradients = [
    "from-indigo-400 to-violet-500",
    "from-blue-400 to-cyan-500",
    "from-emerald-400 to-teal-500",
    "from-rose-400 to-pink-500",
    "from-amber-400 to-orange-500",
    "from-violet-400 to-purple-500",
  ];
  const idx = name.charCodeAt(0) % gradients.length;
  return gradients[idx];
}

export default function Teams() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Member Profile & Remarks Modal State
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [remarksText, setRemarksText] = useState("");
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [remarksSaved, setRemarksSaved] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const openMemberProfile = async (m: Member) => {
    setSelectedMember(m);
    setRemarksText(m.remarks || "");
    setRemarksSaved(false);
    setLoadingProfile(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/users/${m.id}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      });
      if (res.ok) {
        const d = await res.json();
        const profile = d.user || d.data || d;
        setSelectedMember(prev => ({ ...prev!, ...profile }));
        setRemarksText(profile.remarks || "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSaveMemberRemarks = async () => {
    if (!selectedMember) return;
    setSavingRemarks(true);
    setRemarksSaved(false);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/users/${selectedMember.id}/remarks`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: remarksText }),
      });

      if (res.ok) {
        setRemarksSaved(true);
        setMembers(prev => prev.map(mbr => mbr.id === selectedMember.id ? { ...mbr, remarks: remarksText } : mbr));
        setSelectedMember(prev => prev ? { ...prev, remarks: remarksText } : null);
        setTimeout(() => setRemarksSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRemarks(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      if (!token) { router.push("/login"); return; }
      const headers: HeadersInit = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      try {
        const res = await fetch(`${API_BASE}/teams/members`, { headers });
        if (res.ok) {
          const d = await res.json();
          const list = Array.isArray(d) ? d : (d.members || d.data || d.users || []);
          setMembers(list);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [router]);

  const filtered = members.filter(m =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (m.email || "").toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  const roles = Array.from(new Set(members.map(m => m.role)));

  if (loading) return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-1">Organization</p>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{members.length} members across {roles.length} roles</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {roles.slice(0, 4).map(role => (
          <div key={role} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{members.filter(m => m.role === role).length}</p>
            <p className="text-xs font-semibold text-gray-500 mt-1 truncate">{role}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search team members..."
        className="w-full max-w-sm px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all shadow-sm"
      />

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(m => (
          <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 flex flex-col items-center text-center group">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarGradient(m.full_name)} flex items-center justify-center text-white text-lg font-bold mb-3 shadow-sm`}>
              {getInitials(m.full_name)}
            </div>
            <p className="text-[14px] font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{m.full_name}</p>
            {m.email && (
              <p className="text-xs text-gray-400 mt-0.5 truncate w-full max-w-[160px]">{m.email}</p>
            )}
            <span className={`mt-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${roleColor(m.role)}`}>
              {m.role}
            </span>
            {m.team_name && (
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Briefcase size={10} /> {m.team_name}
              </p>
            )}
            {m.remarks && (
              <p className="text-[11px] text-slate-500 italic mt-2.5 line-clamp-2 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg w-full">
                "{m.remarks}"
              </p>
            )}
            <button
              onClick={() => openMemberProfile(m)}
              className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-100 cursor-pointer"
            >
              <FileText size={12} /> Remarks & Profile
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Users size={22} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-600">No members found</p>
          </div>
        )}
      </div>

      {/* Profile & Remarks Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
            <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white flex-shrink-0">
              <button
                onClick={() => setSelectedMember(null)}
                className="absolute right-5 top-5 p-1.5 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-xl flex items-center justify-center shadow-lg border border-white/20">
                  {getInitials(selectedMember.full_name)}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedMember.full_name}</h2>
                  <p className="text-xs text-indigo-200 font-medium">{selectedMember.job_title || selectedMember.role}</p>
                  <p className="text-[11px] text-white/50">{selectedMember.email}</p>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Remarks */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-indigo-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Member Remarks</h3>
                      <p className="text-[11px] text-slate-500">Add profile feedback, mentorship notes, or remarks.</p>
                    </div>
                  </div>
                  {remarksSaved && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={12} /> Saved!
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={remarksText}
                  onChange={e => setRemarksText(e.target.value)}
                  placeholder="Enter remarks for this member..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveMemberRemarks}
                    disabled={savingRemarks}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Check size={13} /> {savingRemarks ? "Saving..." : "Save Remarks"}
                  </button>
                </div>
              </div>

              {/* Projects */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Projects</h4>
                {loadingProfile ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : !selectedMember.projects || selectedMember.projects.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No assigned projects.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedMember.projects.map((p: any) => (
                      <div key={p.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <p className="font-bold text-slate-900">{p.name}</p>
                        <p className="text-[10px] text-slate-400">{p.project_role || "Member"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedMember(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
