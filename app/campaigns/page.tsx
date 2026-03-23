"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type Buyer = {
  id: string;
  name: string;
  status: string;
};

type CampaignBuyerLink = {
  id: string;
  priority: number;
  buyer: Buyer;
};

type Campaign = {
  id: string;
  name: string;
  slug: string;
  vertical: string;
  routingMode: string;
  status: string;
  createdAt: string;
  buyerLinks: CampaignBuyerLink[];
  leads: {
    id: string;
  }[];
};

type CampaignDraft = {
  status: string;
  routingMode: string;
};

type NewCampaignForm = {
  name: string;
  slug: string;
  vertical: string;
  routingMode: string;
  status: string;
};

function truncateId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function statusBadgeClass(status: string) {
  return status === "active"
    ? "bg-green-100 text-green-700"
    : "bg-yellow-100 text-yellow-700";
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(
    null
  );
  const [drafts, setDrafts] = useState<Record<string, CampaignDraft>>({});
  const [newBuyerSelections, setNewBuyerSelections] = useState<
    Record<string, string>
  >({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [routingFilter, setRoutingFilter] = useState("all");

  const [newCampaign, setNewCampaign] = useState<NewCampaignForm>({
    name: "",
    slug: "",
    vertical: "",
    routingMode: "round_robin",
    status: "active",
  });

  async function fetchCampaigns() {
    try {
      const res = await fetch("/api/campaigns");

      if (!res.ok) {
        throw new Error("Failed to fetch campaigns");
      }

      const json = await res.json();
      const campaignData = json.data || [];
      const buyerData = json.meta?.buyers || [];

      setCampaigns(campaignData);
      setBuyers(buyerData);

      const nextDrafts: Record<string, CampaignDraft> = {};
      campaignData.forEach((campaign: Campaign) => {
        nextDrafts[campaign.id] = {
          status: campaign.status,
          routingMode: campaign.routingMode,
        };
      });

      setDrafts(nextDrafts);
    } catch (err) {
      console.error("Campaign fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCampaigns();
  }, []);

  function updateDraft(
    id: string,
    field: keyof CampaignDraft,
    value: string
  ) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

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
        routingMode: "round_robin",
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

    try {
      setSavingId(id);

      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: draft.status,
          routingMode: draft.routingMode,
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
      draft.status !== campaign.status ||
      draft.routingMode !== campaign.routingMode
    );
  }

  async function addBuyerToCampaign(campaignId: string) {
    const buyerId = newBuyerSelections[campaignId];
    if (!buyerId) return;

    try {
      const res = await fetch("/api/campaign-buyers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId,
          buyerId,
          priority: 1,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to add buyer to campaign");
      }

      setNewBuyerSelections((prev) => ({
        ...prev,
        [campaignId]: "",
      }));

      await fetchCampaigns();
    } catch (err) {
      console.error("Add buyer error:", err);
    }
  }

  async function updateLinkPriority(linkId: string, priority: number) {
    try {
      const res = await fetch(`/api/campaign-buyers/${linkId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priority,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update priority");
      }

      await fetchCampaigns();
    } catch (err) {
      console.error("Update priority error:", err);
    }
  }

  async function removeBuyerLink(linkId: string) {
    try {
      const res = await fetch(`/api/campaign-buyers/${linkId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to remove buyer link");
      }

      await fetchCampaigns();
    } catch (err) {
      console.error("Remove buyer link error:", err);
    }
  }

  const filteredCampaigns = useMemo(() => {
    const searchLower = search.toLowerCase().trim();

    return campaigns.filter((campaign) => {
      const matchesSearch =
        searchLower === "" ||
        campaign.id.toLowerCase().includes(searchLower) ||
        campaign.name.toLowerCase().includes(searchLower) ||
        campaign.slug.toLowerCase().includes(searchLower) ||
        campaign.vertical.toLowerCase().includes(searchLower);

      const matchesStatus =
        statusFilter === "all" || campaign.status === statusFilter;

      const matchesRouting =
        routingFilter === "all" || campaign.routingMode === routingFilter;

      return matchesSearch && matchesStatus && matchesRouting;
    });
  }, [campaigns, search, statusFilter, routingFilter]);

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
            Manage campaign settings, linked buyers, priorities, routing modes,
            and lead volume.
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
                  Create a new campaign and define its routing behavior.
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

            <div className="grid gap-4 md:grid-cols-3">
              <div>
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
                  onChange={(e) => updateNewCampaign("slug", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Required"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Vertical
                </label>
                <input
                  value={newCampaign.vertical}
                  onChange={(e) =>
                    updateNewCampaign("vertical", e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Required"
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
                  <option value="round_robin">round_robin</option>
                  <option value="ping_post">ping_post</option>
                  <option value="direct_post">direct_post</option>
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

          <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <div className="xl:col-span-2">
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

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Routing Mode
              </label>
              <select
                value={routingFilter}
                onChange={(e) => setRoutingFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All routing modes</option>
                <option value="round_robin">round_robin</option>
                <option value="ping_post">ping_post</option>
                <option value="direct_post">direct_post</option>
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
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Vertical</th>
                <th className="px-4 py-3 font-medium">Routing</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Buyers</th>
                <th className="px-4 py-3 font-medium">Leads</th>
              </tr>
            </thead>

            <tbody>
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No campaigns found.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => {
                  const isExpanded = expandedCampaignId === campaign.id;
                  const draft = drafts[campaign.id];
                  const linkedBuyerIds = new Set(
                    campaign.buyerLinks.map((link) => link.buyer.id)
                  );
                  const availableBuyers = buyers.filter(
                    (buyer) => !linkedBuyerIds.has(buyer.id)
                  );

                  return (
                    <Fragment key={campaign.id}>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <button
                            onClick={() =>
                              setExpandedCampaignId(
                                isExpanded ? null : campaign.id
                              )
                            }
                            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            {isExpanded ? "−" : "+"}
                          </button>
                        </td>

                        <td className="px-4 py-4 font-medium text-blue-700">
                          {truncateId(campaign.id)}
                        </td>

                        <td className="px-4 py-4 text-gray-500">
                          {new Date(campaign.createdAt).toLocaleString()}
                        </td>

                        <td className="px-4 py-4 font-medium text-gray-900">
                          {campaign.name}
                        </td>

                        <td className="px-4 py-4">{campaign.slug}</td>

                        <td className="px-4 py-4">{campaign.vertical}</td>

                        <td className="px-4 py-4">{campaign.routingMode}</td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                              campaign.status
                            )}`}
                          >
                            {campaign.status}
                          </span>
                        </td>

                        <td className="px-4 py-4">{campaign.buyerLinks.length}</td>

                        <td className="px-4 py-4">{campaign.leads.length}</td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <td colSpan={10} className="px-6 py-6">
                            <div className="grid gap-6 xl:grid-cols-3">
                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-800">
                                  Campaign Settings
                                </h3>

                                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                  <div className="grid gap-4">
                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Campaign Status
                                      </label>
                                      <select
                                        value={draft?.status || campaign.status}
                                        onChange={(e) =>
                                          updateDraft(
                                            campaign.id,
                                            "status",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                        disabled={savingId === campaign.id}
                                      >
                                        <option value="active">active</option>
                                        <option value="paused">paused</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Routing Mode
                                      </label>
                                      <select
                                        value={
                                          draft?.routingMode ||
                                          campaign.routingMode
                                        }
                                        onChange={(e) =>
                                          updateDraft(
                                            campaign.id,
                                            "routingMode",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                        disabled={savingId === campaign.id}
                                      >
                                        <option value="round_robin">
                                          round_robin
                                        </option>
                                        <option value="ping_post">
                                          ping_post
                                        </option>
                                        <option value="direct_post">
                                          direct_post
                                        </option>
                                      </select>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => saveCampaign(campaign.id)}
                                        disabled={
                                          !isDirty(campaign) ||
                                          savingId === campaign.id
                                        }
                                        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {savingId === campaign.id
                                          ? "Saving..."
                                          : "Save"}
                                      </button>

                                      {isDirty(campaign) &&
                                        savingId !== campaign.id && (
                                          <span className="text-sm text-amber-600">
                                            Unsaved changes
                                          </span>
                                        )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3 xl:col-span-2">
                                <h3 className="text-sm font-semibold text-gray-800">
                                  Linked Buyers
                                </h3>

                                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                  {campaign.buyerLinks.length === 0 ? (
                                    <div className="text-sm text-gray-500">
                                      No buyers linked yet.
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-gray-100 text-left text-gray-500">
                                            <th className="pb-3 pr-4 font-medium">
                                              Buyer
                                            </th>
                                            <th className="pb-3 pr-4 font-medium">
                                              Status
                                            </th>
                                            <th className="pb-3 pr-4 font-medium">
                                              Priority
                                            </th>
                                            <th className="pb-3 font-medium">
                                              Actions
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {campaign.buyerLinks.map((link) => (
                                            <tr
                                              key={link.id}
                                              className="border-b border-gray-100 last:border-0"
                                            >
                                              <td className="py-4 pr-4 font-medium text-gray-900">
                                                {link.buyer.name}
                                              </td>

                                              <td className="py-4 pr-4">
                                                <span
                                                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                                                    link.buyer.status
                                                  )}`}
                                                >
                                                  {link.buyer.status}
                                                </span>
                                              </td>

                                              <td className="py-4 pr-4">
                                                <input
                                                  type="number"
                                                  min={1}
                                                  value={link.priority}
                                                  onChange={(e) =>
                                                    updateLinkPriority(
                                                      link.id,
                                                      Number(e.target.value)
                                                    )
                                                  }
                                                  className="w-24 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                                />
                                              </td>

                                              <td className="py-4">
                                                <button
                                                  onClick={() =>
                                                    removeBuyerLink(link.id)
                                                  }
                                                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                                                >
                                                  Remove
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}

                                  <div className="mt-5 flex flex-col gap-3 md:flex-row">
                                    <select
                                      value={newBuyerSelections[campaign.id] || ""}
                                      onChange={(e) =>
                                        setNewBuyerSelections((prev) => ({
                                          ...prev,
                                          [campaign.id]: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                    >
                                      <option value="">Select buyer to link</option>
                                      {availableBuyers.map((buyer) => (
                                        <option key={buyer.id} value={buyer.id}>
                                          {buyer.name} ({buyer.status})
                                        </option>
                                      ))}
                                    </select>

                                    <button
                                      onClick={() =>
                                        addBuyerToCampaign(campaign.id)
                                      }
                                      disabled={!newBuyerSelections[campaign.id]}
                                      className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Add Buyer
                                    </button>
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