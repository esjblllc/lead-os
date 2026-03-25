"use client";

import { useEffect, useMemo, useState } from "react";

type Organization = {
  id: string;
  name: string;
};

type InviteRecord = {
  id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
  organizationId: string;
  organization: Organization;
};

type SessionUser = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organization: Organization;
};

type NewInviteForm = {
  email: string;
  role: string;
  organizationId: string;
  expiresInDays: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function truncateId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function statusBadgeClass(status: string) {
  if (status === "accepted") return "bg-green-100 text-green-700";
  if (status === "pending") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

export default function InvitesPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [copiedToken, setCopiedToken] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [useNewOrg, setUseNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");

  const [newInvite, setNewInvite] = useState<NewInviteForm>({
    email: "",
    role: "member",
    organizationId: "",
    expiresInDays: "7",
  });

  const isPlatform = sessionUser?.role === "platform_admin";
  const canManageInvites =
    sessionUser?.role === "platform_admin" || sessionUser?.role === "admin";

  async function fetchPageData() {
    try {
      const [sessionRes, invitesRes] = await Promise.all([
        fetch("/api/session/me", { cache: "no-store" }),
        fetch("/api/invites", { cache: "no-store" }),
      ]);

      const sessionJson = sessionRes.ok ? await sessionRes.json() : { data: null };
      const invitesJson = invitesRes.ok
        ? await invitesRes.json()
        : { data: [], organizations: [] };

      const currentUser = sessionJson.data || null;

      setSessionUser(currentUser);
      setInvites(invitesJson.data || []);
      setOrganizations(invitesJson.organizations || []);

      if (currentUser?.role !== "platform_admin") {
        setNewInvite((prev) => ({
          ...prev,
          role: "member",
          organizationId: currentUser?.organizationId || "",
        }));
      }
    } catch (error) {
      console.error("Failed to load invites page:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPageData();
  }, []);

  function updateNewInvite(field: keyof NewInviteForm, value: string) {
    setNewInvite((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!newInvite.email.trim()) {
      setCreateError("Email is required.");
      return;
    }

    if (isPlatform && !useNewOrg && !newInvite.organizationId) {
      setCreateError("Select an organization or create a new one.");
      return;
    }

    if (isPlatform && useNewOrg && !newOrgName.trim()) {
      setCreateError("New organization name is required.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newInvite.email,
          role: isPlatform ? newInvite.role : "member",
          organizationId: isPlatform
            ? useNewOrg
              ? null
              : newInvite.organizationId
            : null,
          organizationName: isPlatform
            ? useNewOrg
              ? newOrgName.trim()
              : null
            : null,
          expiresInDays: Number(newInvite.expiresInDays || "7"),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create invite");
      }

      setCreateSuccess("Invite created successfully.");
      setNewInvite({
        email: "",
        role: isPlatform ? "admin" : "member",
        organizationId: isPlatform ? "" : sessionUser?.organizationId || "",
        expiresInDays: "7",
      });
      setUseNewOrg(false);
      setNewOrgName("");

      await fetchPageData();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create invite");
    } finally {
      setCreating(false);
    }
  }

  async function copyInviteLink(token: string) {
    try {
      const inviteUrl = `${window.location.origin}/invite/${token}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(""), 2000);
    } catch (error) {
      console.error("Failed to copy invite link:", error);
    }
  }

  const filteredInvites = useMemo(() => {
    const q = search.toLowerCase().trim();

    return invites.filter((invite) => {
      const matchesSearch =
        q === "" ||
        invite.id.toLowerCase().includes(q) ||
        invite.email.toLowerCase().includes(q) ||
        invite.organization?.name?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || invite.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invites, search, statusFilter]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading invites...</div>;
  }

  if (!canManageInvites) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Invites</h1>
        <p className="mt-2 text-sm text-gray-500">
          You do not have permission to manage invites.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Invites
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Invite Management
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {isPlatform
              ? "Create invite links across organizations and assign invite roles."
              : `Create invite links for ${sessionUser?.organization?.name || "your organization"}.`}
          </p>
        </div>

        <div className="p-6">
          <form
            onSubmit={createInvite}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  New Invite
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Generate a secure invite link and send it manually.
                </p>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Invite"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  value={newInvite.email}
                  onChange={(e) => updateNewInvite("email", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="friend@example.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Role
                </label>
                {isPlatform ? (
                  <select
                    value={newInvite.role}
                    onChange={(e) => updateNewInvite("role", e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
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
                  Expires In
                </label>
                <select
                  value={newInvite.expiresInDays}
                  onChange={(e) => updateNewInvite("expiresInDays", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Organization
                </label>
                {isPlatform ? (
                  <div className="space-y-2">
                    <select
                      disabled={useNewOrg}
                      value={newInvite.organizationId}
                      onChange={(e) => updateNewInvite("organizationId", e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
                    >
                      <option value="">Select existing organization</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={useNewOrg}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setUseNewOrg(checked);

                          if (checked) {
                            updateNewInvite("organizationId", "");
                          } else {
                            setNewOrgName("");
                          }
                        }}
                      />
                      Create new organization
                    </label>

                    {useNewOrg ? (
                      <input
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder="New organization name"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                      />
                    ) : null}
                  </div>
                ) : (
                  <input
                    value={sessionUser?.organization?.name || ""}
                    disabled
                    className="w-full rounded-xl border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
                  />
                )}
              </div>
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
                placeholder="Invite ID, email, organization..."
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
                <option value="pending">pending</option>
                <option value="accepted">accepted</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Invite ID</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredInvites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                    No invites found.
                  </td>
                </tr>
              ) : (
                filteredInvites.map((invite) => (
                  <tr key={invite.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-4 font-medium text-blue-700">
                      {truncateId(invite.id)}
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-900">
                      {invite.email}
                    </td>
                    <td className="px-4 py-4">{invite.role}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                          invite.status
                        )}`}
                      >
                        {invite.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">{invite.organization?.name || "—"}</td>
                    <td className="px-4 py-4 text-gray-600">
                      {formatDate(invite.expiresAt)}
                    </td>
                    <td className="px-4 py-4">
                      {invite.status === "pending" ? (
                        <button
                          onClick={() => copyInviteLink(invite.token)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          {copiedToken === invite.token ? "Copied" : "Copy Invite Link"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}