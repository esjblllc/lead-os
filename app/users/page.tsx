"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type Organization = {
  id: string;
  name: string;
};

type UserRecord = {
  id: string;
  email: string;
  role: string;
  status: string;
  organizationId: string;
  organization: Organization;
  createdAt?: string;
};

type SessionUser = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organization: Organization;
};

type UserDraft = {
  email: string;
  password: string;
  role: string;
  status: string;
  organizationId: string;
};

type NewUserForm = {
  email: string;
  password: string;
  role: string;
  status: string;
  organizationId: string;
  organizationName: string;
};

function truncateId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function statusBadgeClass(status: string) {
  return status === "active"
    ? "bg-green-100 text-green-700"
    : "bg-yellow-100 text-yellow-700";
}

export default function UsersPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [newUser, setNewUser] = useState<NewUserForm>({
    email: "",
    password: "",
    role: "member",
    status: "active",
    organizationId: "",
    organizationName: "",
  });

  const isPlatform = sessionUser?.role === "platform_admin";
  const canManageUsers =
    sessionUser?.role === "platform_admin" || sessionUser?.role === "admin";

  async function fetchPageData() {
    try {
      const [sessionRes, usersRes] = await Promise.all([
        fetch("/api/session/me", { cache: "no-store" }),
        fetch("/api/users", { cache: "no-store" }),
      ]);

      const sessionJson = sessionRes.ok ? await sessionRes.json() : { data: null };
      const usersJson = usersRes.ok
        ? await usersRes.json()
        : { data: [], organizations: [] };

      const currentUser = sessionJson.data || null;

      setSessionUser(currentUser);
      setUsers(usersJson.data || []);
      setOrganizations(usersJson.organizations || []);

      const nextDrafts: Record<string, UserDraft> = {};
      (usersJson.data || []).forEach((user: UserRecord) => {
        nextDrafts[user.id] = {
          email: user.email,
          password: "",
          role: user.role,
          status: user.status,
          organizationId: user.organizationId,
        };
      });

      setDrafts(nextDrafts);

      if (currentUser?.role !== "platform_admin") {
        setNewUser((prev) => ({
          ...prev,
          role: "member",
          organizationId: currentUser?.organizationId || "",
          organizationName: "",
        }));
      }
    } catch (error) {
      console.error("Failed to load users page:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPageData();
  }, []);

  function updateDraft(id: string, field: keyof UserDraft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  function updateNewUser(field: keyof NewUserForm, value: string) {
    setNewUser((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!newUser.email.trim() || !newUser.password.trim()) {
      setCreateError("Email and password are required.");
      return;
    }

    if (
      isPlatform &&
      !newUser.organizationId &&
      !newUser.organizationName.trim()
    ) {
      setCreateError("Select an organization or enter a new organization name.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          role: isPlatform ? newUser.role : "member",
          status: newUser.status,
          organizationId: isPlatform ? newUser.organizationId || null : null,
          organizationName: isPlatform
            ? newUser.organizationId
              ? null
              : newUser.organizationName || null
            : null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create user");
      }

      setCreateSuccess("User created successfully.");
      setNewUser({
        email: "",
        password: "",
        role: isPlatform ? "admin" : "member",
        status: "active",
        organizationId: isPlatform ? "" : sessionUser?.organizationId || "",
        organizationName: "",
      });

      await fetchPageData();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function saveUser(id: string) {
    const draft = drafts[id];
    if (!draft) return;

    try {
      setSavingId(id);

      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: draft.email,
          password: draft.password || undefined,
          role: isPlatform ? draft.role : undefined,
          status: draft.status,
          organizationId: isPlatform ? draft.organizationId : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update user");
      }

      await fetchPageData();
    } catch (error) {
      console.error("Save user error:", error);
    } finally {
      setSavingId(null);
    }
  }

  function isDirty(user: UserRecord) {
    const draft = drafts[user.id];
    if (!draft) return false;

    return (
      draft.email !== user.email ||
      draft.password !== "" ||
      draft.role !== user.role ||
      draft.status !== user.status ||
      draft.organizationId !== user.organizationId
    );
  }

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();

    return users.filter((user) => {
      const matchesSearch =
        q === "" ||
        user.id.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.organization?.name?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [users, search, statusFilter]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading users...</div>;
  }

  if (!canManageUsers) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Users</h1>
        <p className="mt-2 text-sm text-gray-500">
          You do not have permission to manage users.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Users
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            User Management
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {isPlatform
              ? "Manage users across organizations, roles, and account status."
              : `Manage users in ${sessionUser?.organization?.name || "your organization"}.`}
          </p>
        </div>

        <div className="p-6">
          <form
            onSubmit={createUser}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  New User
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {isPlatform
                    ? "Create a login and assign the user to an existing or new organization."
                    : "Create a user inside your organization."}
                </p>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create User"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  value={newUser.email}
                  onChange={(e) => updateNewUser("email", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="tester@example.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => updateNewUser("password", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Required"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Role
                </label>
                {isPlatform ? (
                  <select
                    value={newUser.role}
                    onChange={(e) => updateNewUser("role", e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="platform_admin">platform_admin</option>
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                  </select>
                ) : (
                  <input
                    value="member"
                    disabled
                    className="w-full rounded-xl border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
                  />
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={newUser.status}
                  onChange={(e) => updateNewUser("status", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>

              {isPlatform ? (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Existing Organization
                    </label>
                    <select
                      value={newUser.organizationId}
                      onChange={(e) =>
                        updateNewUser("organizationId", e.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select organization</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Or New Organization Name
                    </label>
                    <input
                      value={newUser.organizationName}
                      onChange={(e) =>
                        updateNewUser("organizationName", e.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                      placeholder="Friend Test Org"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Organization
                  </label>
                  <input
                    value={sessionUser?.organization?.name || ""}
                    disabled
                    className="w-full rounded-xl border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
                  />
                </div>
              )}
            </div>

            {createError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            ) : null}

            {createSuccess ? (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {createSuccess}
              </div>
            ) : null}
          </form>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                type="text"
                placeholder="User ID, email, organization..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">User ID</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Organization</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isExpanded = expandedUserId === user.id;
                  const draft = drafts[user.id];

                  return (
                    <Fragment key={user.id}>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <button
                            onClick={() =>
                              setExpandedUserId(isExpanded ? null : user.id)
                            }
                            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            {isExpanded ? "−" : "+"}
                          </button>
                        </td>

                        <td className="px-4 py-4 font-medium text-blue-700">
                          {truncateId(user.id)}
                        </td>
                        <td className="px-4 py-4 font-medium text-gray-900">
                          {user.email}
                        </td>
                        <td className="px-4 py-4">{user.role}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                              user.status
                            )}`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {user.organization?.name || "—"}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <td colSpan={6} className="px-6 py-6">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                              <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                  Email
                                </label>
                                <input
                                  value={draft?.email || ""}
                                  onChange={(e) =>
                                    updateDraft(user.id, "email", e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                  New Password
                                </label>
                                <input
                                  type="password"
                                  value={draft?.password || ""}
                                  onChange={(e) =>
                                    updateDraft(user.id, "password", e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                  placeholder="Leave blank to keep current"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                  Role
                                </label>
                                {isPlatform ? (
                                  <select
                                    value={draft?.role || "admin"}
                                    onChange={(e) =>
                                      updateDraft(user.id, "role", e.target.value)
                                    }
                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                  >
                                    <option value="platform_admin">platform_admin</option>
                                    <option value="admin">admin</option>
                                    <option value="member">member</option>
                                  </select>
                                ) : (
                                  <input
                                    value={user.role}
                                    disabled
                                    className="w-full rounded-xl border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
                                  />
                                )}
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                  Status
                                </label>
                                <select
                                  value={draft?.status || "active"}
                                  onChange={(e) =>
                                    updateDraft(user.id, "status", e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                >
                                  <option value="active">active</option>
                                  <option value="inactive">inactive</option>
                                </select>
                              </div>

                              <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                  Organization
                                </label>
                                {isPlatform ? (
                                  <select
                                    value={draft?.organizationId || ""}
                                    onChange={(e) =>
                                      updateDraft(
                                        user.id,
                                        "organizationId",
                                        e.target.value
                                      )
                                    }
                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                  >
                                    {organizations.map((org) => (
                                      <option key={org.id} value={org.id}>
                                        {org.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    value={user.organization?.name || ""}
                                    disabled
                                    className="w-full rounded-xl border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
                                  />
                                )}
                              </div>
                            </div>

                            <div className="mt-5 flex items-center gap-3">
                              <button
                                onClick={() => saveUser(user.id)}
                                disabled={!isDirty(user) || savingId === user.id}
                                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {savingId === user.id ? "Saving..." : "Save"}
                              </button>

                              {isDirty(user) && savingId !== user.id && (
                                <span className="text-sm text-amber-600">
                                  Unsaved changes
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}