"use client";

import React, { useEffect, useState } from "react";
import {
  UserPlus,
  Users,
  Search,
  X,
  Loader2,
  UserCheck,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";

type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  job_title?: string | null;
  last_login_at?: string | null;
  created_at?: string;
};

const ROLES = [
  "System Administrator",
  "Executive Manager",
  "Project Manager",
  "Task Manager",
  "Member",
  "Worker",
];

function getToken() {
  if (typeof window === "undefined") return "";

  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function UsersPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);

  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "Member",
    jobTitle: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* =========================================================
     AUTH
  ========================================================= */

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      setCurrentUser(user);

      if (user.role !== "System Administrator") {
        router.replace("/dashboard");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  /* =========================================================
     FETCH USERS
  ========================================================= */

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/users`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load users.");
      }

      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === "System Administrator") {
      fetchUsers();
    }
  }, [currentUser]);

  /* =========================================================
     CREATE USER
  ========================================================= */

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!form.fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!form.password) {
      setError("Password is required.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          jobTitle: form.jobTitle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create user.");
      }

      setSuccess("User created successfully.");

      setUsers((prev) => [data.user, ...prev]);

      setForm({
        fullName: "",
        email: "",
        password: "",
        role: "Member",
        jobTitle: "",
      });

      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to create user.");
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     ACTIVATE / DEACTIVATE
  ========================================================= */

  const toggleUserStatus = async (user: User) => {
    try {
      const response = await fetch(
        `${API_BASE}/users/${user.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            isActive: !user.is_active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update user.");
      }

      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? { ...item, is_active: data.user.is_active }
            : item
        )
      );
    } catch (err: any) {
      setError(err.message || "Failed to update user.");
    }
  };

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredUsers = users.filter((user) => {
    const value = search.toLowerCase();

    return (
      user.full_name.toLowerCase().includes(value) ||
      user.email.toLowerCase().includes(value) ||
      user.role.toLowerCase().includes(value) ||
      (user.job_title || "").toLowerCase().includes(value)
    );
  });

  if (!currentUser) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-black/40" size={25} />
      </div>
    );
  }

  if (currentUser.role !== "System Administrator") {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1440px]">

        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-black/45">
              <Users size={16} />
              Administration
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-black">
              User Management
            </h1>

            <p className="mt-1 text-sm text-black/50">
              Create and manage Project Managers, Executive Managers,
              Members and other system users.
            </p>
          </div>

          <button
            onClick={() => {
              setError("");
              setSuccess("");
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-black/80"
          >
            <UserPlus size={17} />
            Add User
          </button>
        </div>

        {/* =====================================================
            SUCCESS / ERROR
        ====================================================== */}

        {success && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* =====================================================
            SEARCH
        ====================================================== */}

        <div className="mb-5 rounded-2xl border border-black/10 bg-white p-4">
          <div className="relative max-w-md">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full rounded-xl border border-black/15 bg-white py-2.5 pl-10 pr-4 text-sm text-black outline-none placeholder:text-black/35 focus:border-black"
            />
          </div>
        </div>

        {/* =====================================================
            USERS TABLE
        ====================================================== */}

        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">

          <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
            <div>
              <h2 className="font-semibold text-black">
                Users
              </h2>

              <p className="mt-0.5 text-xs text-black/45">
                {filteredUsers.length} user
                {filteredUsers.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[250px] items-center justify-center">
              <Loader2
                size={25}
                className="animate-spin text-black/30"
              />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center">
              <Users size={32} className="mb-3 text-black/20" />
              <p className="text-sm text-black/45">
                No users found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">

                <thead>
                  <tr className="border-b border-black/10 bg-[#fafafa] text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-black/45">
                      User
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold text-black/45">
                      Role
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold text-black/45">
                      Job Title
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold text-black/45">
                      Status
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold text-black/45">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-black/5 last:border-0 hover:bg-black/[0.015]"
                    >
                      {/* USER */}

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
                            {getInitials(user.full_name)}
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-black">
                              {user.full_name}
                            </p>

                            <p className="text-xs text-black/45">
                              {user.email}
                            </p>
                          </div>

                        </div>
                      </td>

                      {/* ROLE */}

                      <td className="px-5 py-4">
                        <span className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-medium text-black/70">
                          {user.role}
                        </span>
                      </td>

                      {/* JOB TITLE */}

                      <td className="px-5 py-4 text-sm text-black/60">
                        {user.job_title || "—"}
                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-4">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <UserCheck size={14} />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500">
                            <UserX size={14} />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* ACTION */}

                      <td className="px-5 py-4">
                        <button
                          onClick={() => toggleUserStatus(user)}
                          disabled={user.id === currentUser.id}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                            user.id === currentUser.id
                              ? "cursor-not-allowed border-black/5 text-black/20"
                              : user.is_active
                              ? "border-red-200 text-red-500 hover:bg-red-50"
                              : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {user.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </div>

        {/* =====================================================
            CREATE USER MODAL
        ====================================================== */}

        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setModalOpen(false);
              }
            }}
          >
            <div className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">

              {/* MODAL HEADER */}

              <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">

                <div>
                  <h2 className="text-lg font-semibold text-black">
                    Create New User
                  </h2>

                  <p className="mt-0.5 text-xs text-black/45">
                    Add a new user to ProjectSpace.
                  </p>
                </div>

                <button
                  onClick={() => setModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-black/45 transition hover:bg-black/5 hover:text-black"
                >
                  <X size={18} />
                </button>

              </div>

              {/* FORM */}

              <form
                onSubmit={createUser}
                className="space-y-4 p-6"
              >

                {/* FULL NAME */}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-black/65">
                    Full Name
                  </label>

                  <input
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        fullName: e.target.value,
                      })
                    }
                    placeholder="e.g. Bruce Wayne"
                    className="w-full rounded-xl border border-black/15 px-3.5 py-3 text-sm text-black outline-none placeholder:text-black/30 focus:border-black"
                  />
                </div>

                {/* EMAIL */}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-black/65">
                    Email
                  </label>

                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email: e.target.value,
                      })
                    }
                    placeholder="user@arg.com"
                    className="w-full rounded-xl border border-black/15 px-3.5 py-3 text-sm text-black outline-none placeholder:text-black/30 focus:border-black"
                  />
                </div>

                {/* PASSWORD */}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-black/65">
                    Initial Password
                  </label>

                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        password: e.target.value,
                      })
                    }
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-xl border border-black/15 px-3.5 py-3 text-sm text-black outline-none placeholder:text-black/30 focus:border-black"
                  />
                </div>

                {/* ROLE */}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-black/65">
                    Role
                  </label>

                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        role: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-black/15 bg-white px-3.5 py-3 text-sm text-black outline-none focus:border-black"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* JOB TITLE */}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-black/65">
                    Job Title
                  </label>

                  <input
                    value={form.jobTitle}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        jobTitle: e.target.value,
                      })
                    }
                    placeholder="e.g. Backend Engineer"
                    className="w-full rounded-xl border border-black/15 px-3.5 py-3 text-sm text-black outline-none placeholder:text-black/30 focus:border-black"
                  />
                </div>

                {/* ERROR */}

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-600">
                    {error}
                  </div>
                )}

                {/* ACTIONS */}

                <div className="flex justify-end gap-3 border-t border-black/10 pt-5">

                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium text-black/60 hover:bg-black/5"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving && (
                      <Loader2
                        size={15}
                        className="animate-spin"
                      />
                    )}

                    {saving ? "Creating..." : "Create User"}
                  </button>

                </div>

              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


