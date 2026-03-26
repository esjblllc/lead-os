"use client";

import { useEffect, useMemo, useState } from "react";

type Organization = {
  id: string;
  name: string;
};

type TrackingCampaign = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  destinationUrl: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  organization: Organization;
  _count?: {
    links: number;
    clicks: number;
  };
};

type SessionUser = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organization: Organization;
};

type NewCampaignForm = {
  name: string;
  slug: string;
  destinationUrl: string;
  status: string;
  notes: string;
  organizationId: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function truncateId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function statusBadgeClass(status: string) {
  return status === "active"
    ? "bg-green-100 text-green-700"
    : "bg-yellow-100 text-yellow-700";
}

export default function TrackingCampaignsPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [campaigns, setCampaigns] = useState<TrackingCampaign[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [newCampaign, setNewCampaign] = useState<NewCampaignForm>({
    name: "",
    slug: "",
    destinationUrl: "",
    status: "active",
    notes: "",
    organizationId: "",
  });

  const isPlatform = sessionUser?.role === "platform_admin";
  const canManage =
    sessionUser?.role === "platform_admin" || sessionUser?.role === "admin";

  async function fetchPageData() {
    try {
      const [sessionRes, campaignsRes] = await Promise.all([
        fetch("/api/session/me", { cache: "no-store" }),
        fetch("/api/tracking-campaigns", { cache: "no-store" }),
      ]);

      const sessionJson = sessionRes.ok ? await sessionRes.json() : { data: null };
      const campaignsJson = campaignsRes.ok
        ? await campaignsRes.json()
        : { data: [], organizations: [] };

      const currentUser = sessionJson.data || null;

      setSessionUser(currentUser);
      setCampaigns(campaignsJson.data || []);
      setOrganizations(campaignsJson.organizations || []);

      if (currentUser?.role !== "platform_admin") {
        setNewCampaign((prev) => ({
          ...prev,
          organizationId: currentUser?.organizationId || "",
        }));
      }
    } catch (error) {
      console.error("Failed to load tracking campaigns page:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPageData();
  }, []);

  function updateNewCampaign(field: keyof NewCampaignForm, value: string) {
    setNewCampaign((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!newCampaign.name.trim() || !newCampaign.destinationUrl.trim()) {
      setCreateError("Name and destination URL are required.");
      return;
    }

    if (isPlatform && !newCampaign.organizationId) {
      setCreateError("Organization is required.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch("/api/tracking-campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newCampaign.name,
          slug: newCampaign.slug || undefined,
          destinationUrl: newCampaign.destinationUrl,
          status: newCampaign.status,
          notes: newCampaign.notes || null,
          organizationId: isPlatform ? newCampaign.organizationId : null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create tracking campaign");
      }

      setCreateSuccess("Tracking campaign created successfully.");
      setNewCampaign({
        name: "",
        slug: "",
        destinationUrl: "",
        status: "active",
        notes: "",
        organizationId: isPlatform ? "" : sessionUser?.organizationId || "",
      });

      await fetchPageData();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create tracking campaign");
    } finally {
      setCreating(false);
    }
  }

  const filteredCampaigns = useMemo(() => {
    const q = search.toLowerCase().trim();

    return campaigns.filter((campaign) => {
      const matchesSearch =
        q === "" ||
        campaign.id.toLowerCase().includes(q) ||
        campaign.name.toLowerCase().includes(q) ||
        campaign.slug.toLowerCase().includes(q) ||
        campaign.destinationUrl.toLowerCase().includes(q) ||
        campaign.organization?.name?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || campaign.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [campaigns, search, statusFilter]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading tracking campaigns...</div>;
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Tracking Campaigns
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          You do not have permission to manage tracking campaigns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Link Tracking Suite
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Tracking Campaigns
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Create campaign containers for your front-end traffic, destination URLs, and future tracking links.
          </p>
        </div>

        <div className="p-6">
          <form
            onSubmit={createCampaign}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  New Tracking Campaign
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Define the default destination URL and base campaign settings.
                </p>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Campaign"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Campaign Name
                </label>
                <input
                  value={newCampaign.name}
                  onChange={(e) => updateNewCampaign("name", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Facebook Auto Accident"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Slug
                </label>
                <input
                  value={newCampaign.slug}
                  onChange={(e) => updateNewCampaign("slug", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Optional - auto-generated if blank"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={newCampaign.status}
                  onChange={(e) => updateNewCampaign("status", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Destination URL
                </label>
                <input
                  value={newCampaign.destinationUrl}
                  onChange={(e) => updateNewCampaign("destinationUrl", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="https://example.com/landing-page"
                />
              </div>

              {isPlatform ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Organization
                  </label>
                  <select
                    value={newCampaign.organizationId}
                    onChange={(e) => updateNewCampaign("organizationId", e.target.value)}
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
              ) : null}

              <div className="md:col-span-2 xl:col-span-3">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={newCampaign.notes}
                  onChange={(e) => updateNewCampaign("notes", e.target.value)}
                  className="min-h-[96px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Optional notes"
                />
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
                placeholder="Campaign ID, name, slug, URL, organization..."
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
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Campaign ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Destination URL</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Links</th>
                <th className="px-4 py-3 font-medium">Clicks</th>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>

            <tbody>
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                    No tracking campaigns found.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-4 font-medium text-blue-700">
                      {truncateId(campaign.id)}
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-900">
                      {campaign.name}
                    </td>
                    <td className="px-4 py-4">{campaign.slug}</td>
                    <td className="px-4 py-4 max-w-[320px] truncate">
                      {campaign.destinationUrl}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                          campaign.status
                        )}`}
                      >
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">{campaign._count?.links ?? 0}</td>
                    <td className="px-4 py-4">{campaign._count?.clicks ?? 0}</td>
                    <td className="px-4 py-4">
                      {campaign.organization?.name || "—"}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {formatDate(campaign.createdAt)}
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