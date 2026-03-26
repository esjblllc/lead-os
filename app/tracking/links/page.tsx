"use client";

import { useEffect, useMemo, useState } from "react";

type Organization = {
  id: string;
  name: string;
};

type TrackingCampaign = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
};

type TrackingLink = {
  id: string;
  organizationId: string;
  trackingCampaignId: string;
  name: string;
  slug: string;
  trafficSource?: string | null;
  publisherId?: string | null;
  subId?: string | null;
  subId2?: string | null;
  subId3?: string | null;
  costModel: string;
  costPerClick?: number | null;
  destinationUrl?: string | null;
  status: string;
  createdAt: string;
  organization: Organization;
  trackingCampaign: TrackingCampaign;
  _count?: {
    clicks: number;
    leads: number;
  };
};

type SessionUser = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organization: Organization;
};

type NewLinkForm = {
  name: string;
  slug: string;
  trackingCampaignId: string;
  trafficSource: string;
  publisherId: string;
  subId: string;
  subId2: string;
  subId3: string;
  costModel: string;
  costPerClick: string;
  destinationUrl: string;
  status: string;
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

export default function TrackingLinksPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [campaigns, setCampaigns] = useState<TrackingCampaign[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [copiedSlug, setCopiedSlug] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [newLink, setNewLink] = useState<NewLinkForm>({
    name: "",
    slug: "",
    trackingCampaignId: "",
    trafficSource: "",
    publisherId: "",
    subId: "",
    subId2: "",
    subId3: "",
    costModel: "cpc",
    costPerClick: "",
    destinationUrl: "",
    status: "active",
    organizationId: "",
  });

  const isPlatform = sessionUser?.role === "platform_admin";
  const canManage =
    sessionUser?.role === "platform_admin" || sessionUser?.role === "admin";

  async function fetchPageData() {
    try {
      const [sessionRes, linksRes] = await Promise.all([
        fetch("/api/session/me", { cache: "no-store" }),
        fetch("/api/tracking-links", { cache: "no-store" }),
      ]);

      const sessionJson = sessionRes.ok ? await sessionRes.json() : { data: null };
      const linksJson = linksRes.ok
        ? await linksRes.json()
        : { data: [], campaigns: [], organizations: [] };

      const currentUser = sessionJson.data || null;

      setSessionUser(currentUser);
      setLinks(linksJson.data || []);
      setCampaigns(linksJson.campaigns || []);
      setOrganizations(linksJson.organizations || []);

      if (currentUser?.role !== "platform_admin") {
        setNewLink((prev) => ({
          ...prev,
          organizationId: currentUser?.organizationId || "",
        }));
      }
    } catch (error) {
      console.error("Failed to load tracking links page:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPageData();
  }, []);

  function updateNewLink(field: keyof NewLinkForm, value: string) {
    setNewLink((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!newLink.name.trim() || !newLink.trackingCampaignId) {
      setCreateError("Name and tracking campaign are required.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch("/api/tracking-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newLink.name,
          slug: newLink.slug || undefined,
          trackingCampaignId: newLink.trackingCampaignId,
          trafficSource: newLink.trafficSource || null,
          publisherId: newLink.publisherId || null,
          subId: newLink.subId || null,
          subId2: newLink.subId2 || null,
          subId3: newLink.subId3 || null,
          costModel: newLink.costModel,
          costPerClick: newLink.costPerClick === "" ? null : Number(newLink.costPerClick),
          destinationUrl: newLink.destinationUrl || null,
          status: newLink.status,
          organizationId: isPlatform ? newLink.organizationId : null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create tracking link");
      }

      setCreateSuccess("Tracking link created successfully.");
      setNewLink({
        name: "",
        slug: "",
        trackingCampaignId: "",
        trafficSource: "",
        publisherId: "",
        subId: "",
        subId2: "",
        subId3: "",
        costModel: "cpc",
        costPerClick: "",
        destinationUrl: "",
        status: "active",
        organizationId: isPlatform ? "" : sessionUser?.organizationId || "",
      });

      await fetchPageData();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create tracking link");
    } finally {
      setCreating(false);
    }
  }

  async function copyTrackingUrl(slug: string) {
    try {
      const url = `${window.location.origin}/t/${slug}`;
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(""), 2000);
    } catch (error) {
      console.error("Failed to copy tracking URL:", error);
    }
  }

  const filteredCampaigns = useMemo(() => {
    if (!isPlatform && sessionUser?.organizationId) {
      return campaigns.filter(
        (campaign) => campaign.organizationId === sessionUser.organizationId
      );
    }
    return campaigns;
  }, [campaigns, isPlatform, sessionUser?.organizationId]);

  const filteredLinks = useMemo(() => {
    const q = search.toLowerCase().trim();

    return links.filter((link) => {
      const matchesSearch =
        q === "" ||
        link.id.toLowerCase().includes(q) ||
        link.name.toLowerCase().includes(q) ||
        link.slug.toLowerCase().includes(q) ||
        (link.trafficSource || "").toLowerCase().includes(q) ||
        (link.publisherId || "").toLowerCase().includes(q) ||
        (link.subId || "").toLowerCase().includes(q) ||
        link.trackingCampaign?.name?.toLowerCase().includes(q) ||
        link.organization?.name?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || link.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [links, search, statusFilter]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading tracking links...</div>;
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Tracking Links
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          You do not have permission to manage tracking links.
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
            Tracking Links
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Create click-tracking URLs for traffic sources, publishers, and sub IDs.
          </p>
        </div>

        <div className="p-6">
          <form
            onSubmit={createLink}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  New Tracking Link
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Create a redirectable tracking URL that logs every click.
                </p>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Link"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Link Name
                </label>
                <input
                  value={newLink.name}
                  onChange={(e) => updateNewLink("name", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="FB Auto Accident - Publisher A"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Slug
                </label>
                <input
                  value={newLink.slug}
                  onChange={(e) => updateNewLink("slug", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Optional - auto-generated if blank"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Tracking Campaign
                </label>
                <select
                  value={newLink.trackingCampaignId}
                  onChange={(e) => updateNewLink("trackingCampaignId", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select campaign</option>
                  {filteredCampaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Traffic Source
                </label>
                <input
                  value={newLink.trafficSource}
                  onChange={(e) => updateNewLink("trafficSource", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="facebook"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Publisher ID
                </label>
                <input
                  value={newLink.publisherId}
                  onChange={(e) => updateNewLink("publisherId", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="publisher_123"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Sub ID
                </label>
                <input
                  value={newLink.subId}
                  onChange={(e) => updateNewLink("subId", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="sub_123"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Sub ID 2
                </label>
                <input
                  value={newLink.subId2}
                  onChange={(e) => updateNewLink("subId2", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Sub ID 3
                </label>
                <input
                  value={newLink.subId3}
                  onChange={(e) => updateNewLink("subId3", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={newLink.status}
                  onChange={(e) => updateNewLink("status", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Cost Model
                </label>
                <select
                  value={newLink.costModel}
                  onChange={(e) => updateNewLink("costModel", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="cpc">cpc</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Cost Per Click
                </label>
                <input
                  value={newLink.costPerClick}
                  onChange={(e) => updateNewLink("costPerClick", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="0.50"
                />
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Override Destination URL
                </label>
                <input
                  value={newLink.destinationUrl}
                  onChange={(e) => updateNewLink("destinationUrl", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Optional - campaign destination will be used if blank"
                />
              </div>

              {isPlatform ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Organization
                  </label>
                  <select
                    value={newLink.organizationId}
                    onChange={(e) => updateNewLink("organizationId", e.target.value)}
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
                placeholder="Link ID, name, slug, source, publisher, sub ID..."
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
          <table className="min-w-[1450px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Link ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Publisher</th>
                <th className="px-4 py-3 font-medium">Sub ID</th>
                <th className="px-4 py-3 font-medium">CPC</th>
                <th className="px-4 py-3 font-medium">Clicks</th>
                <th className="px-4 py-3 font-medium">Leads</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">URL</th>
              </tr>
            </thead>

            <tbody>
              {filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-sm text-gray-500">
                    No tracking links found.
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link) => (
                  <tr key={link.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-4 font-medium text-blue-700">
                      {truncateId(link.id)}
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-900">
                      {link.name}
                    </td>
                    <td className="px-4 py-4">{link.slug}</td>
                    <td className="px-4 py-4">{link.trackingCampaign?.name || "—"}</td>
                    <td className="px-4 py-4">{link.trafficSource || "—"}</td>
                    <td className="px-4 py-4">{link.publisherId || "—"}</td>
                    <td className="px-4 py-4">{link.subId || "—"}</td>
                    <td className="px-4 py-4">
                      {link.costPerClick !== null && typeof link.costPerClick !== "undefined"
                        ? `$${Number(link.costPerClick).toFixed(4)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-4">{link._count?.clicks ?? 0}</td>
                    <td className="px-4 py-4">{link._count?.leads ?? 0}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                          link.status
                        )}`}
                      >
                        {link.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => copyTrackingUrl(link.slug)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                      >
                        {copiedSlug === link.slug ? "Copied" : "Copy URL"}
                      </button>
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