"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type Campaign = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  vertical: string;
  routingMode: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

type CampaignDraft = {
  name: string;
  slug: string;
  vertical: string;
  routingMode: string;
  status: string;
};

type NewCampaignForm = {
  name: string;
  slug: string;
  vertical: string;
  routingMode: string;
  status: string;
};

function normalize(value: unknown) {
  return value === null || typeof value === "undefined" ? "" : String(value);
}

function truncateId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function statusBadgeClass(status: string) {
  return status === "active"
    ? "bg-green-100 text-green-700"
    : "bg-yellow-100 text-yellow-700";
}

function routingModeLabel(mode: string) {
  if (mode === "ping_post") return "Ping/Post";
  return "Direct Post";
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, CampaignDraft>>({});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [routingModeFilter, setRoutingModeFilter] = useState("all");

  const [newCampaign, setNewCampaign] = useState<NewCampaignForm>({
    name: "",
    slug: "",
    vertical: "",
    routingMode: "direct_post",
    status: "active",
  });

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function fetchCampaigns() {
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    const campaignData = data.data || [];

    setCampaigns(campaignData);

    const nextDrafts: Record<string, CampaignDraft> = {};
    campaignData.forEach((campaign: Campaign) => {
      nextDrafts[campaign.id] = {
        name: campaign.name || "",
        slug: campaign.slug || "",
        vertical: campaign.vertical || "",
        routingMode: campaign.routingMode || "direct_post",
        status: campaign.status || "active",
      };
    });

    setDrafts(nextDrafts);
    setLoading(false);
  }

  useEffect(() => {
    fetchCampaigns();
  }, []);

  function updateDraft(id: string, field: keyof CampaignDraft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  function updateNewCampaign(field: keyof NewCampaignForm, value: string) {
    setNewCampaign((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === "name" && (!prev.slug || prev.slug === slugify(prev.name))) {
        next.slug = slugify(value);
      }

      return next;
    });
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!newCampaign.name.trim()) {
      setCreateError("Campaign name is required.");
      return;
    }

    if (!newCampaign.slug.trim()) {
      setCreateError("Campaign slug is required.");
      return;
    }

    if (!newCampaign.vertical.trim()) {
      setCreateError("Vertical is required.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newCampaign.name,
          slug: newCampaign.slug,
          vertical: newCampaign.vertical,
          routingMode: newCampaign.routingMode,
          status: newCampaign.status,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create campaign");
      }

      setCreateSuccess("Campaign created successfully.");

      setNewCampaign({
        name: "",
        slug: "",
        vertical: "",
        routingMode: "direct_post",
        status: "active",
      });

      await fetchCampaigns();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  }

  async function saveCampaign(id: string) {
    const draft = drafts[id];
    if (!draft) return;

    if (!draft.name.trim() || !draft.slug.trim() || !draft.vertical.trim()) {
      return;
    }

    try {
      setSavingId(id);

      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: draft.name,
          slug: draft.slug,
          vertical: draft.vertical,
          routingMode: draft.routingMode,
          status: draft.status,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update campaign");
      }

      await fetchCampaigns();
    } catch (err) {
      console.error("Campaign save error:", err);
    } finally {
      setSavingId(null);
    }
  }

  function isDirty(campaign: Campaign) {
    const draft = drafts[campaign.id];
    if (!draft) return false;

    return (
      draft.name !== normalize(campaign.name) ||
      draft.slug !== normalize(campaign.slug) ||
      draft.vertical !== normalize(campaign.vertical) ||
      draft.routingMode !== normalize(campaign.routingMode || "direct_post") ||
      draft.status !== normalize(campaign.status)
    );
  }

  const filteredCampaigns = useMemo(() => {
    const searchLower = search.toLowerCase().trim();

    return campaigns.filter((campaign) => {
      const matchesSearch =
        searchLower === "" ||
        campaign.id.toLowerCase().includes(searchLower) ||
        (campaign.name || "").toLowerCase().includes(searchLower) ||
        (campaign.slug || "").toLowerCase().includes(searchLower) ||
        (campaign.vertical || "").toLowerCase().includes(searchLower);

      const matchesStatus =
        statusFilter === "all" || campaign.status === statusFilter;

      const matchesRoutingMode =
        routingModeFilter === "all" || campaign.routingMode === routingModeFilter;

      return matchesSearch && matchesStatus && matchesRoutingMode;
    });
  }, [campaigns, search, statusFilter, routingModeFilter]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading campaigns...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Campaigns
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Campaign Management
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage campaign slugs, verticals, routing mode, and live status.
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
                  New Campaign
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Create a campaign and choose whether it runs Direct Post or Ping/Post.
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

            <div className="grid gap-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Campaign Name
                </label>
                <input
                  value={newCampaign.name}
                  onChange={(e) => updateNewCampaign("name", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Required"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Slug
                </label>
                <input
                  value={newCampaign.slug}
                  onChange={(e) =>
                    updateNewCampaign("slug", slugify(e.target.value))
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="test-campaign"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Vertical
                </label>
                <input
                  value={newCampaign.vertical}
                  onChange={(e) => updateNewCampaign("vertical", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Auto Accident"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Routing Mode
                </label>
                <select
                  value={newCampaign.routingMode}
                  onChange={(e) =>
                    updateNewCampaign("routingMode", e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="direct_post">Direct Post</option>
                  <option value="ping_post">Ping/Post</option>
                </select>
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
                  <option value="paused">paused</option>
                </select>
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

          <div className="mt-6 grid gap-4 md:grid-cols-4 xl:grid-cols-6">
            <div className="md:col-span-2 xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                type="text"
                placeholder="Campaign ID, name, slug, vertical..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Routing Mode
              </label>
              <select
                value={routingModeFilter}
                onChange={(e) => setRoutingModeFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All modes</option>
                <option value="direct_post">Direct Post</option>
                <option value="ping_post">Ping/Post</option>
              </select>
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
                <option value="paused">paused</option>
              </select>
            </div>

            <div className="flex items-end text-sm text-gray-500">
              Showing {filteredCampaigns.length} of {campaigns.length} campaigns
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
                <th className="px-4 py-3 font-medium">Campaign ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Vertical</th>
                <th className="px-4 py-3 font-medium">Routing Mode</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                    No campaigns found.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => {
                  const isExpanded = expandedCampaignId === campaign.id;
                  const draft = drafts[campaign.id];

                  return (
                    <Fragment key={campaign.id}>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <button
                            onClick={() =>
                              setExpandedCampaignId(isExpanded ? null : campaign.id)
                            }
                            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            {isExpanded ? "−" : "+"}
                          </button>
                        </td>

                        <td className="px-4 py-4 font-medium text-blue-700">
                          {truncateId(campaign.id)}
                        </td>

                        <td className="px-4 py-4 font-medium text-gray-900">
                          {campaign.name}
                        </td>

                        <td className="px-4 py-4">{campaign.slug}</td>
                        <td className="px-4 py-4">{campaign.vertical}</td>
                        <td className="px-4 py-4">
                          {routingModeLabel(campaign.routingMode)}
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
                      </tr>

                      {isExpanded && (
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <td colSpan={7} className="px-6 py-6">
                            <div className="grid gap-6 xl:grid-cols-3">
                              <div className="space-y-3 xl:col-span-2">
                                <h3 className="text-sm font-semibold text-gray-800">
                                  Campaign Settings
                                </h3>

                                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Campaign Name
                                      </label>
                                      <input
                                        value={draft?.name || ""}
                                        onChange={(e) =>
                                          updateDraft(campaign.id, "name", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Slug
                                      </label>
                                      <input
                                        value={draft?.slug || ""}
                                        onChange={(e) =>
                                          updateDraft(
                                            campaign.id,
                                            "slug",
                                            slugify(e.target.value)
                                          )
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Vertical
                                      </label>
                                      <input
                                        value={draft?.vertical || ""}
                                        onChange={(e) =>
                                          updateDraft(
                                            campaign.id,
                                            "vertical",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Routing Mode
                                      </label>
                                      <select
                                        value={draft?.routingMode || "direct_post"}
                                        onChange={(e) =>
                                          updateDraft(
                                            campaign.id,
                                            "routingMode",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      >
                                        <option value="direct_post">Direct Post</option>
                                        <option value="ping_post">Ping/Post</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Status
                                      </label>
                                      <select
                                        value={draft?.status || "active"}
                                        onChange={(e) =>
                                          updateDraft(
                                            campaign.id,
                                            "status",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      >
                                        <option value="active">active</option>
                                        <option value="paused">paused</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="mt-5 flex items-center gap-3">
                                    <button
                                      onClick={() => saveCampaign(campaign.id)}
                                      disabled={!isDirty(campaign) || savingId === campaign.id}
                                      className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {savingId === campaign.id ? "Saving..." : "Save"}
                                    </button>

                                    {isDirty(campaign) && savingId !== campaign.id && (
                                      <span className="text-sm text-amber-600">
                                        Unsaved changes
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-800">
                                  Routing Notes
                                </h3>

                                <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm shadow-sm space-y-4">
                                  <div>
                                    <div className="font-medium text-gray-800">Current Mode</div>
                                    <div className="mt-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                                      {routingModeLabel(draft?.routingMode || campaign.routingMode)}
                                    </div>
                                  </div>

                                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                                    <div className="font-semibold">Direct Post</div>
                                    <div className="mt-1">
                                      Posts the full lead directly to linked buyers in priority order.
                                    </div>
                                  </div>

                                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800">
                                    <div className="font-semibold">Ping/Post</div>
                                    <div className="mt-1">
                                      Pings linked buyers first, stores bids, selects the winning buyer,
                                      then posts the full lead.
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-medium text-gray-800">Campaign Slug</div>
                                    <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-700 break-all">
                                      {draft?.slug || campaign.slug}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-medium text-gray-800">Test Payload Field</div>
                                    <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                                      Inbound posts should send:
                                      <div className="mt-2 font-mono">
                                        {`"campaignSlug": "${draft?.slug || campaign.slug}"`}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
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