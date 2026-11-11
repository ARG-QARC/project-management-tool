"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bell, Search, LogOut, User, ChevronDown, Layers, Check,
  Menu, CheckSquare, FolderKanban, Briefcase, UserCheck
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useProgram } from "@/context/ProgramContext";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/programs": "Teams & Programs",
  "/projects": "Projects",
  "/tasks": "Tasks",
  "/reports": "Reports",
  "/schedule": "Schedule",
  "/performance": "Performance",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/projects/")) return "Project Details";
  return "Platform";
}

function getInitials(name?: string) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function TopBar() {
  const { user, logout } = useAuth();
  const { programs, selectedProgram, selectProgram } = useProgram();
  const router = useRouter();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const teamMenuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (teamMenuRef.current && !teamMenuRef.current.contains(e.target as Node)) {
        setTeamMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    router.replace("/login");
  };

  const initials = getInitials(user?.full_name || user?.name);
  const displayName = user?.full_name || user?.name || "User";
  const role = user?.role || "";

  const roleLower = (user?.role || "").toLowerCase();
  const isManager =
    roleLower.includes("manager") ||
    roleLower.includes("administrator") ||
    roleLower.includes("admin") ||
    roleLower.includes("lead");

  const rawTitle = getPageTitle(pathname);
  const title =
    pathname === "/dashboard"
      ? isManager
        ? "Program Dashboard"
        : "My Dashboard"
      : rawTitle;

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 gap-3 sm:gap-4 sticky top-0 z-20">
      {/* Left side: Mobile Toggle + Page Title & Global Program/Team Switcher */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("toggleSidebar"))}
          className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Toggle Navigation"
        >
          <Menu size={19} />
        </button>

        <h1 className="text-[15px] font-bold text-gray-900 whitespace-nowrap">{title}</h1>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* Program Scope: Fixed assigned program for members, interactive scope selector for managers */}
        {!isManager ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/70 text-xs font-semibold text-indigo-900 shadow-xs" title="Assigned Program">
            <div className="w-4 h-4 rounded bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black flex-shrink-0">
              {selectedProgram?.code || (selectedProgram?.name ? selectedProgram.name.substring(0, 4).toUpperCase() : "QARC")}
            </div>
            <span className="truncate max-w-[220px] font-semibold text-indigo-950">
              {selectedProgram ? selectedProgram.name : "QUANTUM AGENTIC RESEARCH CENTER"}
            </span>
          </div>
        ) : (
          <div ref={teamMenuRef} className="relative">
            <button
              onClick={() => setTeamMenuOpen(o => !o)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
              title="Scope entire platform by Team / Program"
            >
              <div className="w-4 h-4 rounded bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black">
                {selectedProgram ? selectedProgram.code || selectedProgram.name[0] : "★"}
              </div>
              <span className="truncate max-w-[170px]">
                {selectedProgram ? selectedProgram.name : "All Programs & Teams"}
              </span>
              <ChevronDown size={12} className="text-slate-400 ml-0.5" />
            </button>

            {teamMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Select Team / Program Scope
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Filters projects, tasks & metrics across all views
                  </p>
                </div>

                <div className="py-1 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => {
                      selectProgram("all");
                      setTeamMenuOpen(false);
                      router.push("/dashboard");
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        ★
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold truncate ${!selectedProgram ? "text-indigo-600 font-bold" : "text-slate-800"}`}>
                          All Programs & Teams
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">Entire organization</p>
                      </div>
                    </div>
                    {!selectedProgram && <Check size={14} className="text-indigo-600 flex-shrink-0" />}
                  </button>

                  {programs.map((p) => {
                    const isSelected = selectedProgram?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          selectProgram(p.id);
                          setTeamMenuOpen(false);
                          router.push("/dashboard");
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                            {p.code || p.name.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className={`font-semibold truncate ${isSelected ? "text-indigo-600 font-bold" : "text-slate-800"}`}>
                              {p.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{p.domain}</p>
                          </div>
                        </div>
                        {isSelected && <Check size={14} className="text-indigo-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="px-3.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => { setTeamMenuOpen(false); router.push("/programs"); }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Layers size={12} /> Manage All Programs →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden lg:block">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search across workspace..."
            className="w-48 xl:w-64 bg-gray-50 border border-gray-200 text-sm rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 focus:bg-white transition-all placeholder:text-gray-400"
          />
        </div>

        {/* Notification */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full ring-1 ring-white" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200" />

        {/* Profile */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[13px] font-medium text-gray-800 leading-none">{displayName.split(" ")[0]}</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5 truncate max-w-[80px]">{role}</p>
            </div>
            <ChevronDown size={13} className="text-gray-400 hidden sm:block" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</p>
                {role && (
                  <span
                    className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isManager
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    }`}
                  >
                    {user?.role || (isManager ? "Project Manager" : "Team Member")}
                  </span>
                )}
              </div>

              {/* Role-Separated Quick Navigation */}
              <div className="py-1">
                {isManager ? (
                  <>
                    <button
                      onClick={() => { setMenuOpen(false); router.push("/programs"); }}
                      className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Layers size={14} className="text-indigo-600" />
                      <span>Programs & Teams</span>
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); router.push("/tasks"); }}
                      className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <CheckSquare size={14} className="text-amber-600" />
                      <span>Pending Sign-Offs</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setMenuOpen(false); router.push("/tasks"); }}
                      className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <CheckSquare size={14} className="text-emerald-600" />
                      <span>My Assigned Tasks</span>
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); router.push("/projects"); }}
                      className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FolderKanban size={14} className="text-indigo-600" />
                      <span>My Contributing Deliverables</span>
                    </button>
                  </>
                )}
              </div>

              <div className="border-t border-gray-50 mt-1" />
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
