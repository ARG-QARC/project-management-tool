"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Plus, Clock, User, MessageSquare,
  Calendar, Send, AlertCircle, Activity, LayoutList, Search, Filter
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE } from "@/lib/api";

type DailyUpdate = {
  id: string;
  user_id: string;
  user_name?: string;
  date: string;
  content: string;
  created_at: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
];

function avatarGrad(name: string) {
  const safeName = name || "User";
  return AVATAR_GRADIENTS[safeName.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function DailyUpdates() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  
  const isManager = user?.role === "Project Manager" || user?.role === "Task Manager" || user?.role === "Executive Manager" || user?.role?.includes("Admin");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    } else if (user) {
      fetchUpdates();
    }
  }, [user, authLoading, router]);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const url = isManager 
        ? `${API_BASE}/daily-updates` 
        : `${API_BASE}/daily-updates/user/${user?.id}`;
        
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Failed to fetch updates");
      
      const data = await res.json();
      setUpdates(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    
    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      const today = new Date().toISOString().split('T')[0];
      
      const res = await fetch(`${API_BASE}/daily-updates`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          content: newContent,
          date: today
        })
      });
      
      if (!res.ok) throw new Error("Failed to post update");
      
      setNewContent("");
      fetchUpdates();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 min-h-screen">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  const uniqueUsers = Array.from(new Set(updates.map(u => JSON.stringify({ id: u.user_id, name: u.user_name })))).map(u => JSON.parse(u));
  
  const filteredUpdates = updates.filter(u => {
    const matchSearch = searchQuery ? u.content.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    const matchDate = dateFilter ? u.date === dateFilter : true;
    const matchUser = userFilter !== "all" ? u.user_id === userFilter : true;
    return matchSearch && matchDate && matchUser;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] min-h-screen pb-16">
      
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        
        {/* ── Banner Header ── */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5 md:gap-6">
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex-shrink-0 flex items-center justify-center shadow-inner hidden sm:flex">
                <Sparkles className="text-indigo-300" size={32} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <Activity size={12} /> {isManager ? "Team Overview" : "Personal Log"}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Daily Update Tracker
                </h1>
                <p className="text-indigo-200/90 text-sm md:text-[15px] max-w-xl leading-relaxed">
                  {isManager 
                    ? "Monitor team execution, identify blockers quickly, and maintain a pulse on daily engineering velocity." 
                    : "Log your daily engineering progress, highlight wins, and surface blockers to your managers."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Compose Update Card ── */}
        <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/40 p-6 md:p-8 border border-white">
          <div className="flex items-start gap-4">
            <div className={`hidden sm:flex w-12 h-12 rounded-full shrink-0 items-center justify-center text-white font-bold text-lg bg-gradient-to-br ${avatarGrad(user?.full_name || "U")} shadow-inner`}>
              {getInitials(user?.full_name || "U")}
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
              <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                What did you accomplish today?
              </h2>
              <div className="relative">
                <textarea
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 pb-14 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all resize-none min-h-[140px] placeholder:text-slate-400"
                  placeholder="Share your progress, completed tasks, or any blockers..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                />
                
                {/* Submit Toolbar integrated into textarea bottom */}
                <div className="absolute bottom-3 right-3 left-3 flex justify-between items-center pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium px-2">
                    <MessageSquare size={14} /> Keep it concise and clear
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !newContent.trim()}
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    <span>Post Update</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* ── Feed Section ── */}
        <div className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 gap-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <LayoutList size={20} className="text-indigo-500" />
              {isManager ? "Recent Team Activity" : "My Timeline"}
              <div className="text-xs font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-full ml-2">
                {filteredUpdates.length}
              </div>
            </h2>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search updates..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-48 transition-all"
                />
              </div>
              
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-600 w-full sm:w-36 transition-all"
                />
              </div>

              {isManager && (
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={userFilter}
                    onChange={e => setUserFilter(e.target.value)}
                    className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-600 w-full sm:w-40 appearance-none transition-all"
                  >
                    <option value="all">All Members</option>
                    {uniqueUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name || "Unknown User"}</option>
                    ))}
                  </select>
                  <Filter size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              )}
              
              {(searchQuery || dateFilter || userFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setDateFilter("");
                    setUserFilter("all");
                  }}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center gap-2 text-sm font-medium">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {loading && filteredUpdates.length === 0 && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex gap-4 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-4 bg-slate-200 rounded w-1/4" />
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredUpdates.length === 0 && !error && (
            <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm border-dashed">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Clock className="text-indigo-300" size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">
                {updates.length > 0 ? "No matches found" : "No updates yet"}
              </h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                {updates.length > 0 
                  ? "We couldn't find any updates matching your filters. Try clearing them to see more."
                  : (isManager 
                    ? "Your team hasn't posted any daily updates recently."
                    : "You haven't posted any updates yet. Get started by sharing your progress above!")}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {filteredUpdates.map((update) => (
              <div 
                key={update.id} 
                className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 group flex gap-4 md:gap-5"
              >
                {/* Avatar */}
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm md:text-base bg-gradient-to-br ${avatarGrad(update.user_name || "User")} shadow-inner`}>
                  {getInitials(update.user_name || "User")}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                    <h3 className="font-bold text-slate-900 truncate text-base">
                      {update.user_name || "Team Member"}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100/80 px-2.5 py-1 rounded-full w-fit">
                      <Calendar size={12} className="text-indigo-500" />
                      {formatDate(update.date)}
                    </div>
                  </div>
                  <div className="text-sm md:text-[15px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {update.content}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
