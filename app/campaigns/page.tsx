"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  type CustomInboundFieldDefinition,
  INBOUND_FIELD_DEFINITIONS,
  parseInboundFieldList,
  sanitizeCustomInboundFieldKey,
} from "@/lib/inbound-spec";

type Campaign = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  vertical: string;
  routingMode: string;
  status: string;
  inboundRequiredFields?: string | null;
  inboundOptionalFields?: string | null;
  customInboundFields?: string | null;
  publisherSpecNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type CampaignDraft = {
  name: string;
  slug: string;
  vertical: string;
  routingMode: string;
  status: string;
  inboundRequiredFields: string;
  inboundOptionalFields: string;
  customInboundFields: string;
  publisherSpecNotes: string;
};

type NewCampaignForm = CampaignDraft;

type CampaignExportOptions = {
  fromDate: string;
  toDate: string;
  sortOrder: "desc" | "asc";
};

type FieldStatus = "hidden" | "optional" | "required";
const DEFAULT_OPTIONAL_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "state",
  "zip",
].join(",");

function serializeFieldSet(values: Set<string>) {
  return Array.from(values).join(",");
}

function parseCustomFieldDrafts(value: string) {
  if (!value) return [] as CustomInboundFieldDefinition[];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? (parsed as CustomInboundFieldDefinition[])
      : [];
  } catch {
    return [];
  }
}

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
  const [savedNoticeById, setSavedNoticeById] = useState<Record<string, string>>(
    {}
  );
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, CampaignDraft>>({});
  const [exportOptions, setExportOptions] = useState<
    Record<string, CampaignExportOptions>
  >({});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [routingModeFilter, setRoutingModeFilter] = useState("all");

  const [newCampaign, setNewCampaign] = useState<NewCampaignForm>({
    name: "",
    slug: "",
    vertical: "",
    routingMode: "direct_post",
    status: "active",
    inboundRequiredFields: "",
    inboundOptionalFields: DEFAULT_OPTIONAL_FIELDS,
    customInboundFields: "[]",
    publisherSpecNotes: "",
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
        inboundRequiredFields: campaign.inboundRequiredFields || "",
        inboundOptionalFields: campaign.inboundOptionalFields || "",
        customInboundFields: campaign.customInboundFields || "[]",
        publisherSpecNotes: campaign.publisherSpecNotes || "",
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

  function getExportOptions(campaignId: string): CampaignExportOptions {
    return (
      exportOptions[campaignId] || {
        fromDate: "",
        toDate: "",
        sortOrder: "desc",
      }
    );
  }

  function updateExportOptions(
    campaignId: string,
    field: keyof CampaignExportOptions,
    value: string
  ) {
    setExportOptions((prev) => ({
      ...prev,
      [campaignId]: {
        ...getExportOptions(campaignId),
        [field]: value,
      },
    }));
  }

  function clearExportDateRange(campaignId: string) {
    setExportOptions((prev) => ({
      ...prev,
      [campaignId]: {
        ...getExportOptions(campaignId),
        fromDate: "",
        toDate: "",
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

  function getFieldStatus(
    requiredValue: string,
    optionalValue: string,
    fieldKey: string
  ): FieldStatus {
    const required = new Set(parseInboundFieldList(requiredValue));
    if (required.has(fieldKey as never)) return "required";

    const optional = new Set(parseInboundFieldList(optionalValue));
    if (optional.has(fieldKey as never)) return "optional";

    return "hidden";
  }

  function applyFieldStatus(
    requiredValue: string,
    optionalValue: string,
    fieldKey: string,
    status: FieldStatus
  ) {
    const required = new Set(parseInboundFieldList(requiredValue));
    const optional = new Set(parseInboundFieldList(optionalValue));

    required.delete(fieldKey as never);
    optional.delete(fieldKey as never);

    if (status === "required") {
      required.add(fieldKey as never);
    } else if (status === "optional") {
      optional.add(fieldKey as never);
    }

    return {
      inboundRequiredFields: serializeFieldSet(required),
      inboundOptionalFields: serializeFieldSet(optional),
    };
  }

  function setNewFieldStatus(fieldKey: string, status: FieldStatus) {
    setNewCampaign((prev) => ({
      ...prev,
      ...applyFieldStatus(
        prev.inboundRequiredFields,
        prev.inboundOptionalFields,
        fieldKey,
        status
      ),
    }));
  }

  function setDraftFieldStatus(
    campaignId: string,
    fieldKey: string,
    status: FieldStatus
  ) {
    setDrafts((prev) => {
      const current = prev[campaignId];
      if (!current) return prev;

      return {
        ...prev,
        [campaignId]: {
          ...current,
          ...applyFieldStatus(
            current.inboundRequiredFields,
            current.inboundOptionalFields,
            fieldKey,
            status
          ),
        },
      };
    });
  }

  function getCustomFields(value: string) {
    return parseCustomFieldDrafts(value);
  }

  function updateNewCustomFields(
    updater: (fields: CustomInboundFieldDefinition[]) => CustomInboundFieldDefinition[]
  ) {
    setNewCampaign((prev) => ({
      ...prev,
      customInboundFields: JSON.stringify(
        updater(getCustomFields(prev.customInboundFields))
      ),
    }));
  }

  function updateDraftCustomFields(
    campaignId: string,
    updater: (fields: CustomInboundFieldDefinition[]) => CustomInboundFieldDefinition[]
  ) {
    setDrafts((prev) => {
      const current = prev[campaignId];
      if (!current) return prev;

      return {
        ...prev,
        [campaignId]: {
          ...current,
          customInboundFields: JSON.stringify(
            updater(getCustomFields(current.customInboundFields))
          ),
        },
      };
    });
  }

  function addNewCustomField() {
    updateNewCustomFields((fields) => [
      ...fields,
      {
        key: "",
        label: "",
        description: "",
        example: "",
        status: "optional",
      },
    ]);
  }

  function addDraftCustomField(campaignId: string) {
    updateDraftCustomFields(campaignId, (fields) => [
      ...fields,
      {
        key: "",
        label: "",
        description: "",
        example: "",
        status: "optional",
      },
    ]);
  }

  function updateNewCustomField(
    index: number,
    field: keyof CustomInboundFieldDefinition,
    value: string
  ) {
    updateNewCustomFields((fields) =>
      fields.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]:
                field === "key" ? sanitizeCustomInboundFieldKey(value) : value,
            }
          : item
      )
    );
  }

  function updateDraftCustomField(
    campaignId: string,
    index: number,
    field: keyof CustomInboundFieldDefinition,
    value: string
  ) {
    updateDraftCustomFields(campaignId, (fields) =>
      fields.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]:
                field === "key" ? sanitizeCustomInboundFieldKey(value) : value,
            }
          : item
      )
    );
  }

  function removeNewCustomField(index: number) {
    updateNewCustomFields((fields) =>
      fields.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function removeDraftCustomField(campaignId: string, index: number) {
    updateDraftCustomFields(campaignId, (fields) =>
      fields.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function showSavedNotice(campaignId: string, message: string) {
    setSavedNoticeById((prev) => ({
      ...prev,
      [campaignId]: message,
    }));

    window.setTimeout(() => {
      setSavedNoticeById((prev) => {
        if (prev[campaignId] !== message) return prev;
        const next = { ...prev };
        delete next[campaignId];
        return next;
      });
    }, 2500);
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
          inboundRequiredFields: newCampaign.inboundRequiredFields,
          inboundOptionalFields: newCampaign.inboundOptionalFields,
          customInboundFields: newCampaign.customInboundFields,
          publisherSpecNotes: newCampaign.publisherSpecNotes,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create campaign");
      }

      setCreateSuccess("Campaign created successfully.");
      setIsNewCampaignOpen(false);

      setNewCampaign({
        name: "",
        slug: "",
        vertical: "",
        routingMode: "direct_post",
        status: "active",
        inboundRequiredFields: "",
        inboundOptionalFields: DEFAULT_OPTIONAL_FIELDS,
        customInboundFields: "[]",
        publisherSpecNotes: "",
      });

      await fetchCampaigns();
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create campaign"
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveCampaign(id: string, successMessage = "Campaign saved.") {
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
          inboundRequiredFields: draft.inboundRequiredFields,
          inboundOptionalFields: draft.inboundOptionalFields,
          customInboundFields: draft.customInboundFields,
          publisherSpecNotes: draft.publisherSpecNotes,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update campaign");
      }

      await fetchCampaigns();
      showSavedNotice(id, successMessage);
    } catch (err) {
      console.error("Campaign save error:", err);
    } finally {
      setSavingId(null);
    }
  }

  async function exportCampaignLeads(campaign: Campaign) {
    try {
      setExportingId(campaign.id);

      const options = getExportOptions(campaign.id);
      const params = new URLSearchParams();

      if (options.fromDate) params.set("from", options.fromDate);
      if (options.toDate) params.set("to", options.toDate);
      params.set("sort", options.sortOrder);

      const res = await fetch(
        `/api/campaigns/${campaign.id}/leads/export?${params.toString()}`
      );

      if (!res.ok) {
        throw new Error("Failed to export campaign leads");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const contentDisposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
      const filename = filenameMatch?.[1] || `${campaign.slug}-leads.csv`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Campaign export error:", err);
    } finally {
      setExportingId(null);
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
      draft.status !== normalize(campaign.status) ||
      draft.inboundRequiredFields !== normalize(campaign.inboundRequiredFields) ||
      draft.inboundOptionalFields !== normalize(campaign.inboundOptionalFields) ||
      draft.customInboundFields !== normalize(campaign.customInboundFields || "[]") ||
      draft.publisherSpecNotes !== normalize(campaign.publisherSpecNotes)
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
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  New Campaign
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Create a new campaign when you need a fresh slug, routing setup, and publisher spec.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsNewCampaignOpen((prev) => !prev)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {isNewCampaignOpen ? "Hide New Campaign" : "Open New Campaign"}
              </button>
            </div>

            {!isNewCampaignOpen ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
                The new campaign form is collapsed to keep this page cleaner. Open it when you are ready to create a campaign.
              </div>
            ) : null}

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
          </div>

          {isNewCampaignOpen ? (
          <form
            onSubmit={createCampaign}
            className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5"
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

              <div className="md:col-span-5 rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900">
                  Publisher Spec Fields
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  `campaignSlug` is always required. Everything below controls the rest of the inbound payload for this campaign.
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {INBOUND_FIELD_DEFINITIONS.map((field) => (
                    <div
                      key={field.key}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {field.label}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {field.description}
                          </div>
                        </div>

                        <select
                          value={getFieldStatus(
                            newCampaign.inboundRequiredFields,
                            newCampaign.inboundOptionalFields,
                            field.key
                          )}
                          onChange={(e) =>
                            setNewFieldStatus(
                              field.key,
                              e.target.value as FieldStatus
                            )
                          }
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="hidden">Hidden</option>
                          <option value="optional">Optional</option>
                          <option value="required">Required</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        Custom Fields
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        Add campaign-specific fields that should appear in the publisher spec and be validated on inbound posts.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addNewCustomField}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Add Custom Field
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {getCustomFields(newCampaign.customInboundFields).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                        No custom fields added yet.
                      </div>
                    ) : (
                      getCustomFields(newCampaign.customInboundFields).map(
                        (field, index) => (
                          <div
                            key={`new-custom-field-${index}`}
                            className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                          >
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                              <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                  Field Key
                                </label>
                                <input
                                  value={field.key}
                                  onChange={(e) =>
                                    updateNewCustomField(index, "key", e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                  placeholder="dateOfBirth"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                  Label
                                </label>
                                <input
                                  value={field.label}
                                  onChange={(e) =>
                                    updateNewCustomField(index, "label", e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                  placeholder="Date of Birth"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                  Example
                                </label>
                                <input
                                  value={field.example}
                                  onChange={(e) =>
                                    updateNewCustomField(index, "example", e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                  placeholder="1950-01-31"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                  Status
                                </label>
                                <select
                                  value={field.status}
                                  onChange={(e) =>
                                    updateNewCustomField(index, "status", e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                >
                                  <option value="optional">Optional</option>
                                  <option value="required">Required</option>
                                </select>
                              </div>

                              <div className="flex items-end">
                                <button
                                  type="button"
                                  onClick={() => removeNewCustomField(index)}
                                  className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="md:col-span-2 xl:col-span-5">
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                  Description
                                </label>
                                <input
                                  value={field.description}
                                  onChange={(e) =>
                                    updateNewCustomField(
                                      index,
                                      "description",
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                  placeholder="Explain what the publisher should send for this field."
                                />
                              </div>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={addNewCustomField}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Add Another Field
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {creating ? "Creating..." : "Create Campaign"}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Publisher Notes
                  </label>
                  <textarea
                    value={newCampaign.publisherSpecNotes}
                    onChange={(e) =>
                      updateNewCampaign("publisherSpecNotes", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Example: Collect only consumer PII. Do not send diagnosis details in the initial post."
                  />
                </div>
              </div>
            </div>

          </form>
          ) : null}

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
                  const campaignExportOptions = getExportOptions(campaign.id);
                  const savedNotice = savedNoticeById[campaign.id];

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
                                  {savedNotice ? (
                                    <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                                      {savedNotice}
                                    </div>
                                  ) : null}

                                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                                    <div className="mb-4">
                                      <div className="text-sm font-semibold text-gray-900">
                                        Campaign Details
                                      </div>
                                      <div className="mt-1 text-sm text-gray-500">
                                        Core campaign settings and routing behavior.
                                      </div>
                                    </div>

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
                                  </div>

                                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      Publisher Spec Settings
                                    </div>
                                    <div className="mt-1 text-sm text-gray-500">
                                      Set which inbound fields are visible to publishers for this campaign.
                                    </div>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                      {INBOUND_FIELD_DEFINITIONS.map((field) => (
                                        <div
                                          key={field.key}
                                          className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div>
                                              <div className="text-sm font-medium text-gray-900">
                                                {field.label}
                                              </div>
                                              <div className="mt-1 text-xs text-gray-500">
                                                {field.description}
                                              </div>
                                            </div>

                                            <select
                                              value={getFieldStatus(
                                                draft?.inboundRequiredFields || "",
                                                draft?.inboundOptionalFields || "",
                                                field.key
                                              )}
                                              onChange={(e) =>
                                                setDraftFieldStatus(
                                                  campaign.id,
                                                  field.key,
                                                  e.target.value as FieldStatus
                                                )
                                              }
                                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                                            >
                                              <option value="hidden">Hidden</option>
                                              <option value="optional">Optional</option>
                                              <option value="required">Required</option>
                                            </select>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="mt-4 border-t border-gray-200 pt-4">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <div className="text-sm font-medium text-gray-900">
                                            Custom Fields
                                          </div>
                                          <div className="mt-1 text-sm text-gray-500">
                                            Add custom campaign fields to the spec and inbound validation.
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => addDraftCustomField(campaign.id)}
                                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                          Add Custom Field
                                        </button>
                                      </div>

                                      <div className="mt-4 space-y-3">
                                        {getCustomFields(
                                          draft?.customInboundFields || "[]"
                                        ).length === 0 ? (
                                          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                                            No custom fields added yet.
                                          </div>
                                        ) : (
                                          getCustomFields(
                                            draft?.customInboundFields || "[]"
                                          ).map((field, index) => (
                                            <div
                                              key={`draft-custom-field-${campaign.id}-${index}`}
                                              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                                            >
                                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                                <div>
                                                  <label className="mb-2 block text-sm font-medium text-gray-700">
                                                    Field Key
                                                  </label>
                                                  <input
                                                    value={field.key}
                                                    onChange={(e) =>
                                                      updateDraftCustomField(
                                                        campaign.id,
                                                        index,
                                                        "key",
                                                        e.target.value
                                                      )
                                                    }
                                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                                    placeholder="dateOfBirth"
                                                  />
                                                </div>

                                                <div>
                                                  <label className="mb-2 block text-sm font-medium text-gray-700">
                                                    Label
                                                  </label>
                                                  <input
                                                    value={field.label}
                                                    onChange={(e) =>
                                                      updateDraftCustomField(
                                                        campaign.id,
                                                        index,
                                                        "label",
                                                        e.target.value
                                                      )
                                                    }
                                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                                    placeholder="Date of Birth"
                                                  />
                                                </div>

                                                <div>
                                                  <label className="mb-2 block text-sm font-medium text-gray-700">
                                                    Example
                                                  </label>
                                                  <input
                                                    value={field.example}
                                                    onChange={(e) =>
                                                      updateDraftCustomField(
                                                        campaign.id,
                                                        index,
                                                        "example",
                                                        e.target.value
                                                      )
                                                    }
                                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                                    placeholder="1950-01-31"
                                                  />
                                                </div>

                                                <div>
                                                  <label className="mb-2 block text-sm font-medium text-gray-700">
                                                    Status
                                                  </label>
                                                  <select
                                                    value={field.status}
                                                    onChange={(e) =>
                                                      updateDraftCustomField(
                                                        campaign.id,
                                                        index,
                                                        "status",
                                                        e.target.value
                                                      )
                                                    }
                                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                                  >
                                                    <option value="optional">Optional</option>
                                                    <option value="required">Required</option>
                                                  </select>
                                                </div>

                                                <div className="flex items-end">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      removeDraftCustomField(
                                                        campaign.id,
                                                        index
                                                      )
                                                    }
                                                    className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                                                  >
                                                    Remove
                                                  </button>
                                                </div>

                                                <div className="md:col-span-2 xl:col-span-5">
                                                  <label className="mb-2 block text-sm font-medium text-gray-700">
                                                    Description
                                                  </label>
                                                  <input
                                                    value={field.description}
                                                    onChange={(e) =>
                                                      updateDraftCustomField(
                                                        campaign.id,
                                                        index,
                                                        "description",
                                                        e.target.value
                                                      )
                                                    }
                                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                                    placeholder="Explain what the publisher should send for this field."
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>

                                      <div className="mt-4 flex flex-wrap justify-end gap-3">
                                        <button
                                          type="button"
                                          onClick={() => addDraftCustomField(campaign.id)}
                                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                          Add Another Field
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            saveCampaign(
                                              campaign.id,
                                              "Publisher spec saved."
                                            )
                                          }
                                          disabled={
                                            !isDirty(campaign) ||
                                            savingId === campaign.id
                                          }
                                          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {savingId === campaign.id
                                            ? "Saving..."
                                            : "Save Custom Fields"}
                                        </button>
                                      </div>
                                    </div>

                                    <div className="mt-4">
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Publisher Notes
                                      </label>
                                      <textarea
                                        value={draft?.publisherSpecNotes || ""}
                                        onChange={(e) =>
                                          updateDraft(
                                            campaign.id,
                                            "publisherSpecNotes",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                        rows={3}
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-5 flex items-center gap-3">
                                    <button
                                      onClick={() =>
                                        saveCampaign(campaign.id, "Campaign details saved.")
                                      }
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

                                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                                    <div className="flex flex-col gap-4">
                                      <div>
                                        <div className="text-sm font-semibold text-gray-900">
                                          Lead Export
                                        </div>
                                        <div className="mt-1 text-sm text-gray-500">
                                          Download campaign leads as a CSV with an optional date range and date sort order.
                                        </div>
                                      </div>

                                      <div className="grid gap-4 md:grid-cols-4">
                                        <div>
                                          <label className="mb-2 block text-sm font-medium text-gray-700">
                                            From
                                          </label>
                                          <input
                                            type="date"
                                            value={campaignExportOptions.fromDate}
                                            onChange={(e) =>
                                              updateExportOptions(
                                                campaign.id,
                                                "fromDate",
                                                e.target.value
                                              )
                                            }
                                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                          />
                                        </div>

                                        <div>
                                          <label className="mb-2 block text-sm font-medium text-gray-700">
                                            To
                                          </label>
                                          <input
                                            type="date"
                                            value={campaignExportOptions.toDate}
                                            onChange={(e) =>
                                              updateExportOptions(
                                                campaign.id,
                                                "toDate",
                                                e.target.value
                                              )
                                            }
                                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                          />
                                        </div>

                                        <div>
                                          <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Sort by Date
                                          </label>
                                          <select
                                            value={campaignExportOptions.sortOrder}
                                            onChange={(e) =>
                                              updateExportOptions(
                                                campaign.id,
                                                "sortOrder",
                                                e.target.value as "desc" | "asc"
                                              )
                                            }
                                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                          >
                                            <option value="desc">Newest first</option>
                                            <option value="asc">Oldest first</option>
                                          </select>
                                        </div>

                                        <div className="flex items-end">
                                          <button
                                            type="button"
                                            onClick={() => clearExportDateRange(campaign.id)}
                                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                          >
                                            Clear Dates
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex justify-end">
                                        <button
                                          type="button"
                                          onClick={() => exportCampaignLeads(campaign)}
                                          disabled={exportingId === campaign.id}
                                          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {exportingId === campaign.id
                                            ? "Exporting..."
                                            : "Export Leads CSV"}
                                        </button>
                                      </div>
                                    </div>
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

                                  <div>
                                    <div className="font-medium text-gray-800">Publisher Fields</div>
                                    <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                                      Required:{" "}
                                      {parseInboundFieldList(
                                        draft?.inboundRequiredFields || ""
                                      ).join(", ") || "none"}
                                      <br />
                                      Optional:{" "}
                                      {parseInboundFieldList(
                                        draft?.inboundOptionalFields || ""
                                      ).join(", ") || "none"}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-medium text-gray-800">Custom Fields</div>
                                    <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                                      {getCustomFields(
                                        draft?.customInboundFields || "[]"
                                      ).length === 0
                                        ? "none"
                                        : getCustomFields(
                                            draft?.customInboundFields || "[]"
                                          )
                                            .map(
                                              (field) =>
                                                `${field.key} (${field.status})`
                                            )
                                            .join(", ")}
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
