"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  BarChart3,
  CalendarDays,
  Activity,
  Settings,
  Layers,
  ShieldCheck,
  UserCheck,
  Briefcase,
  X,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type NavItem = {
  label: string;
  href: string;
  icon: any;
  badge?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const MANAGER_NAV_GROUPS: NavGroup[] = [
  {
    title: "PROGRAM & DELIVERY",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Programs & Teams", href: "/programs", icon: Layers, badge: "Scope" },
      { label: "All Projects", href: "/projects", icon: FolderKanban },
      { label: "Tasks & Sign-Offs", href: "/tasks", icon: CheckSquare },
    ],
  },
  {
    title: "ANALYTICS & SCHEDULE",
    items: [
      { label: "Master Schedule", href: "/schedule", icon: CalendarDays },
      { label: "Reports & Audits", href: "/reports", icon: BarChart3 },
      { label: "Team Performance", href: "/performance", icon: Activity },
      { label: "Daily Updates", href: "/daily-updates", icon: Sparkles },
    ],
  },
];

const ADMIN_NAV_GROUP: NavGroup = {
  title: "ADMINISTRATION",
  items: [
    { label: "Admin Console", href: "/admin", icon: ShieldCheck, badge: "Admin" },
  ],
};

const MEMBER_NAV_GROUPS: NavGroup[] = [
  {
    title: "MY WORKSPACE",
    items: [
      { label: "My Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "My Program", href: "/programs", icon: Layers },
      { label: "My Assigned Tasks", href: "/tasks", icon: CheckSquare },
      { label: "Contributing Projects", href: "/projects", icon: FolderKanban },
    ],
  },
  {
    title: "TIMELINE & VELOCITY",
    items: [
      { label: "My Schedule", href: "/schedule", icon: CalendarDays },
      { label: "My Velocity & Stats", href: "/performance", icon: Activity },
      { label: "Daily Updates", href: "/daily-updates", icon: Sparkles },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Role detection: Admin Console strictly for System Administrator
  const role = (user?.role || "").toLowerCase();
  const isAdmin = user?.role === "System Administrator" || role === "system administrator";
  const isManager =
    role.includes("manager") ||
    role.includes("lead") ||
    isAdmin;

  let navGroups: NavGroup[];
  if (isManager) {
    navGroups = [...MANAGER_NAV_GROUPS];
    if (isAdmin) {
      navGroups.push(ADMIN_NAV_GROUP);
    }
  } else {
    navGroups = [...MEMBER_NAV_GROUPS];
    if (isAdmin) {
      navGroups.push(ADMIN_NAV_GROUP);
    }
  }

  // Listen for mobile toggle event
  useEffect(() => {
    const handleToggle = () => setMobileOpen((prev) => !prev);
    const handleClose = () => setMobileOpen(false);

    window.addEventListener("toggleSidebar", handleToggle);
    window.addEventListener("closeSidebar", handleClose);

    return () => {
      window.removeEventListener("toggleSidebar", handleToggle);
      window.removeEventListener("closeSidebar", handleClose);
    };
  }, []);

  // Close mobile drawer upon route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        style={{ width: "var(--sidebar-width, 240px)" }}
        className={`fixed inset-y-0 left-0 z-50 md:z-30 flex flex-col bg-[#1e293b] border-r border-white/5 transition-transform duration-200 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo & Close Button */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-white p-0.5 shadow-sm flex items-center justify-center flex-shrink-0">
              <img
                src="/arg-logo.jpg"
                alt="ARG Logo"
                className="h-full w-full object-contain rounded-md"
              />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-bold tracking-tight truncate">Al Rahim Group</p>
              <p className="text-white/40 text-[9px] leading-none mt-0.5 truncate">Project Intelligence</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-white/50 hover:text-white p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Role Identity Badge */}
        <div className="px-4 pt-3 pb-1">
          <div
            className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between ${
              isManager
                ? "bg-indigo-950/40 border-indigo-500/20 text-indigo-300"
                : "bg-emerald-950/40 border-emerald-500/20 text-emerald-300"
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {isManager ? (
                <Briefcase size={12} className="text-indigo-400 shrink-0" />
              ) : (
                <UserCheck size={12} className="text-emerald-400 shrink-0" />
              )}
              <span className="text-[10px] font-bold tracking-wider uppercase truncate">
                {user?.role || (isManager ? "Project Manager" : "Team Member")}
              </span>
            </div>
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isManager ? "bg-indigo-400 animate-pulse" : "bg-emerald-400 animate-pulse"
              }`}
            />
          </div>
        </div>

        {/* Role-Separated Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-white/30">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all relative ${
                        active
                          ? "bg-white/10 text-white shadow-xs"
                          : "text-white/50 hover:text-white/90 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-full" />
                        )}
                        <item.icon
                          size={15}
                          className={
                            active
                              ? isManager
                                ? "text-indigo-400"
                                : "text-emerald-400"
                              : "text-white/30 group-hover:text-white/60"
                          }
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-white/5 flex-shrink-0 space-y-1">
          <Link
            href="/settings/password"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-white/40 hover:text-white/80 hover:bg-white/5 transition-all"
          >
            <Settings size={15} className="text-white/30" />
            <span>Settings</span>
          </Link>
        </div>
      </aside>
    </>
  );
}

