"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/app/components/toast-provider";

type Organization = { id: string; name: string };

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
  publisherPostbackEnabled: boolean;
  publisherPostbackUrl?: string | null;
  postbackSecret: string;
  createdAt: string;
  updatedAt: string;
  conversionPostbacks?: ConversionPostback[];
  organization: Organization;
  trackingCampaign: TrackingCampaign;
  _count?: { clicks: number; leads: number };
};

type ConversionPostback = {
  id: string;
  leadId?: string | null;
  clickId?: string | null;
  eventType: string;
  source?: string | null;
  revenue?: number | string | null;
  cost?: number | string | null;
  profit?: number | string | null;
  targetUrl?: string | null;
  status: string;
  statusCode?: number | null;
  responseBody?: string | null;
  error?: string | null;
  createdAt: string;
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
  publisherPostbackEnabled: boolean;
  publisherPostbackUrl: string;
};

type PostbackDraft = {
  publisherPostbackEnabled: boolean;
  publisherPostbackUrl: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function truncateId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function toMoney(value: number | null | undefined) {
  if (value === null || typeof value === "undefined") return "-";
  return `$${Number(value).toFixed(4)}`;
}

function badgeClass(active: boolean) {
  return active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600";
}

function statusTone(status: string) {
  if (status === "success") return "bg-green-100 text-green-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function buildSoldPostbackTemplate(origin: string, link: TrackingLink) {
  return `${origin}/api/tracking/postbacks/sold?click_id={click_id}&revenue={revenue}&cost={cost}&source=everflow&postback_key=${link.postbackSecret}`;
}

export default function TrackingLinksPage() {
  const { toast } = useToast();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [campaigns, setCampaigns] = useState<TrackingCampaign[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [drafts, setDrafts] = useState<Record<string, PostbackDraft>>({});
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
    publisherPostbackEnabled: false,
    publisherPostbackUrl: "",
  });

  const isPlatform = sessionUser?.role === "platform_admin";
  const canManage = isPlatform || sessionUser?.role === "admin";

  function syncDrafts(nextLinks: TrackingLink[]) {
    setDrafts((prev) => {
      const next: Record<string, PostbackDraft> = {};
      for (const link of nextLinks) {
        next[link.id] = prev[link.id] || {
          publisherPostbackEnabled: link.publisherPostbackEnabled,
          publisherPostbackUrl: link.publisherPostbackUrl || "",
        };
      }
      return next;
    });
  }

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
      const nextLinks = linksJson.data || [];
      setSessionUser(currentUser);
      setLinks(nextLinks);
      setCampaigns(linksJson.campaigns || []);
      setOrganizations(linksJson.organizations || []);
      syncDrafts(nextLinks);
      if (currentUser?.role !== "platform_admin") {
        setNewLink((prev) => ({
          ...prev,
          organizationId: currentUser?.organizationId || "",
        }));
      }
    } catch (error) {
      console.error("Failed to load tracking links page:", error);
      toast({
        title: "Could not load tracking links",
        description: "Refresh the page and try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPageData();
  }, []);

  function updateNewLink(field: keyof NewLinkForm, value: string | boolean) {
    setNewLink((prev) => ({ ...prev, [field]: value }));
  }

  function updateDraft(linkId: string, field: keyof PostbackDraft, value: string | boolean) {
    setDrafts((prev) => ({
      ...prev,
      [linkId]: {
        ...(prev[linkId] || {
          publisherPostbackEnabled: false,
          publisherPostbackUrl: "",
        }),
        [field]: value,
      },
    }));
  }

  async function copyValue(copyId: string, value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(copyId);
      window.setTimeout(() => setCopiedKey(""), 1800);
      toast({
        title: "Copied to clipboard",
        description: `${label} is ready to paste.`,
        variant: "info",
      });
    } catch (error) {
      console.error("Copy failed:", error);
      toast({
        title: "Copy failed",
        description: "Your browser could not copy that value.",
        variant: "error",
      });
    }
  }

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    if (!newLink.name.trim() || !newLink.trackingCampaignId) {
      toast({
        title: "Tracking link creation failed",
        description: "Name and tracking campaign are required.",
        variant: "error",
      });
      return;
    }

    try {
      setCreating(true);
      const res = await fetch("/api/tracking-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          publisherPostbackEnabled: newLink.publisherPostbackEnabled,
          publisherPostbackUrl: newLink.publisherPostbackUrl || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create tracking link");
      toast({
        title: "Tracking link created",
        description: `${newLink.name} is ready for traffic and postbacks.`,
        variant: "success",
      });
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
        publisherPostbackEnabled: false,
        publisherPostbackUrl: "",
      });
      await fetchPageData();
    } catch (error) {
      console.error("Create tracking link failed:", error);
      toast({
        title: "Tracking link creation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  async function savePostbackSettings(link: TrackingLink) {
    const draft = drafts[link.id];
    if (!draft) return;
    if (draft.publisherPostbackEnabled && !draft.publisherPostbackUrl.trim()) {
      toast({
        title: "Publisher URL required",
        description: "Add the outbound publisher postback URL before enabling it.",
        variant: "error",
      });
      return;
    }

    try {
      setSavingLinkId(link.id);
      const res = await fetch(`/api/tracking-links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publisherPostbackEnabled: draft.publisherPostbackEnabled,
          publisherPostbackUrl: draft.publisherPostbackUrl.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update tracking link");
      const updated = json.data as TrackingLink;
      setLinks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setDrafts((prev) => ({
        ...prev,
        [updated.id]: {
          publisherPostbackEnabled: updated.publisherPostbackEnabled,
          publisherPostbackUrl: updated.publisherPostbackUrl || "",
        },
      }));
      toast({
        title: "Postback settings saved",
        description: `${link.name} is ready for sold conversion callbacks.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Save postback settings failed:", error);
      toast({
        title: "Postback settings failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSavingLinkId(null);
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
        (link.publisherPostbackUrl || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || link.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [links, search, statusFilter]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading tracking links...</div>;
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tracking Links</h1>
        <p className="mt-2 text-sm text-gray-500">
          You do not have permission to manage tracking links.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Link Tracking Suite
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Tracking Links
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Create click-tracking URLs, then configure sold-lead postbacks for platforms like Everflow.
          </p>
        </div>
        <div className="p-6">
          <form onSubmit={createLink} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">New Tracking Link</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Create a redirect URL that logs clicks and can later trigger publisher conversion callbacks.
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
              <input value={newLink.name} onChange={(e) => updateNewLink("name", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Link name" />
              <input value={newLink.slug} onChange={(e) => updateNewLink("slug", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Slug (optional)" />
              <select value={newLink.trackingCampaignId} onChange={(e) => updateNewLink("trackingCampaignId", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="">Select campaign</option>
                {filteredCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
              <input value={newLink.trafficSource} onChange={(e) => updateNewLink("trafficSource", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Traffic source" />
              <input value={newLink.publisherId} onChange={(e) => updateNewLink("publisherId", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Publisher ID" />
              <input value={newLink.subId} onChange={(e) => updateNewLink("subId", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Sub ID" />
              <input value={newLink.subId2} onChange={(e) => updateNewLink("subId2", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Sub ID 2" />
              <input value={newLink.subId3} onChange={(e) => updateNewLink("subId3", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Sub ID 3" />
              <input value={newLink.costPerClick} onChange={(e) => updateNewLink("costPerClick", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Cost per click" />
              <input value={newLink.destinationUrl} onChange={(e) => updateNewLink("destinationUrl", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm md:col-span-2" placeholder="Override destination URL (optional)" />
              <select value={newLink.status} onChange={(e) => updateNewLink("status", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
              {isPlatform ? (
                <select value={newLink.organizationId} onChange={(e) => updateNewLink("organizationId", e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="">Select organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={newLink.publisherPostbackEnabled} onChange={(e) => updateNewLink("publisherPostbackEnabled", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                Enable outbound publisher postback
              </label>
              <input
                value={newLink.publisherPostbackUrl}
                onChange={(e) => updateNewLink("publisherPostbackUrl", e.target.value)}
                className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                placeholder="https://publisher.example/postback?click_id={click_id}&payout={revenue}"
              />
              <p className="mt-2 text-xs text-gray-500">
                Supported placeholders: {"{click_id}"}, {"{lead_id}"}, {"{revenue}"}, {"{cost}"}, {"{profit}"}, {"{publisher_id}"}, {"{sub_id}"}.
              </p>
            </div>
          </form>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <input type="text" placeholder="Search links, slug, publisher, postback URL..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm md:col-span-2" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredLinks.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm">
            No tracking links found.
          </div>
        ) : (
          filteredLinks.map((link) => {
            const expanded = expandedLinkId === link.id;
            const draft = drafts[link.id] || {
              publisherPostbackEnabled: link.publisherPostbackEnabled,
              publisherPostbackUrl: link.publisherPostbackUrl || "",
            };
            const soldTemplate =
              typeof window === "undefined" ? "" : buildSoldPostbackTemplate(window.location.origin, link);

            return (
              <div key={link.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                      {truncateId(link.id)}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-gray-900">{link.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      /t/{link.slug} · {link.trackingCampaign?.name || "-"} · source {link.trafficSource || "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(link.publisherPostbackEnabled)}`}>
                      {link.publisherPostbackEnabled ? "publisher postback on" : "publisher postback off"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(link.status === "active")}`}>
                      {link.status}
                    </span>
                    <button type="button" onClick={() => copyValue(`tracking-${link.id}`, `${window.location.origin}/t/${link.slug}`, "Tracking URL")} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100">
                      {copiedKey === `tracking-${link.id}` ? "Copied URL" : "Copy URL"}
                    </button>
                    <button type="button" onClick={() => setExpandedLinkId(expanded ? null : link.id)} className="rounded-xl bg-black px-3 py-2 text-xs font-medium text-white">
                      {expanded ? "Hide Postbacks" : "Manage Postbacks"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 px-6 py-5 md:grid-cols-4">
                  <div><div className="text-xs uppercase tracking-[0.16em] text-gray-400">Publisher</div><div className="mt-2 text-sm text-gray-700">{link.publisherId || "-"}</div></div>
                  <div><div className="text-xs uppercase tracking-[0.16em] text-gray-400">Sub ID</div><div className="mt-2 text-sm text-gray-700">{link.subId || "-"}</div></div>
                  <div><div className="text-xs uppercase tracking-[0.16em] text-gray-400">CPC</div><div className="mt-2 text-sm text-gray-700">{toMoney(link.costPerClick)}</div></div>
                  <div><div className="text-xs uppercase tracking-[0.16em] text-gray-400">Volume</div><div className="mt-2 text-sm text-gray-700">{link._count?.clicks ?? 0} clicks · {link._count?.leads ?? 0} leads</div></div>
                </div>

                {expanded ? (
                  <div className="grid gap-4 border-t border-gray-200 bg-gray-50 px-6 py-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Sold Conversion Intake</div>
                          <h4 className="mt-2 text-lg font-semibold text-gray-900">Internal Postback Endpoint</h4>
                          <p className="mt-1 text-sm text-gray-500">Use this with Everflow or another platform to tell RouteIQ the lead sold.</p>
                        </div>
                        <button type="button" onClick={() => copyValue(`sold-${link.id}`, soldTemplate, "Sold postback template")} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100">
                          {copiedKey === `sold-${link.id}` ? "Copied" : "Copy Sold Postback"}
                        </button>
                      </div>
                      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 font-mono text-xs break-all text-gray-700">
                        {soldTemplate}
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-gray-600">
                        <div>Accepted identifiers: `click_id` or `lead_id`</div>
                        <div>Accepted revenue fields: `revenue`, `payout`, `amount`, `sale_amount`</div>
                        <div>Optional `cost` lets you override spend before profit is recalculated.</div>
                        <div>RouteIQ stores the attempt and can fan the conversion out to the publisher URL below.</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Publisher Handoff</div>
                          <h4 className="mt-2 text-lg font-semibold text-gray-900">Outbound Publisher Postback</h4>
                          <p className="mt-1 text-sm text-gray-500">After RouteIQ records the sale, it can notify your publisher with revenue, cost, and profit tokens.</p>
                        </div>
                        <button type="button" onClick={() => copyValue(`secret-${link.id}`, link.postbackSecret, "Postback key")} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100">
                          {copiedKey === `secret-${link.id}` ? "Copied Key" : "Copy Key"}
                        </button>
                      </div>

                      <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input type="checkbox" checked={draft.publisherPostbackEnabled} onChange={(e) => updateDraft(link.id, "publisherPostbackEnabled", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                        Enable outbound publisher postback
                      </label>

                      <textarea
                        value={draft.publisherPostbackUrl}
                        onChange={(e) => updateDraft(link.id, "publisherPostbackUrl", e.target.value)}
                        rows={4}
                        className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                        placeholder="https://publisher.example/postback?click_id={click_id}&payout={revenue}"
                      />
                      <div className="mt-2 text-xs text-gray-500">
                        Supported placeholders: {"{click_id}"}, {"{lead_id}"}, {"{revenue}"}, {"{cost}"}, {"{profit}"}, {"{publisher_id}"}, {"{sub_id}"}, {"{tracking_link_id}"}.
                      </div>

                      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                        <div>Created: {formatDate(link.createdAt)}</div>
                        <div className="mt-1">Last updated: {formatDate(link.updatedAt)}</div>
                        <div className="mt-1 break-all">Postback key: {link.postbackSecret}</div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => savePostbackSettings(link)} disabled={savingLinkId === link.id} className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                          {savingLinkId === link.id ? "Saving..." : "Save Postback Settings"}
                        </button>
                        <button type="button" onClick={() => copyValue(`publisher-${link.id}`, draft.publisherPostbackUrl, "Publisher postback URL")} disabled={!draft.publisherPostbackUrl.trim()} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                          {copiedKey === `publisher-${link.id}` ? "Copied URL" : "Copy Publisher URL"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 xl:col-span-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Postback Audit Trail</div>
                          <h4 className="mt-2 text-lg font-semibold text-gray-900">Recent Conversion History</h4>
                          <p className="mt-1 text-sm text-gray-500">
                            Review the latest sold callbacks RouteIQ received and whether the outbound publisher postback succeeded.
                          </p>
                        </div>
                        <div className="text-xs text-gray-500">
                          Showing {link.conversionPostbacks?.length ?? 0} recent events
                        </div>
                      </div>

                      {link.conversionPostbacks && link.conversionPostbacks.length > 0 ? (
                        <div className="mt-4 overflow-x-auto">
                          <table className="min-w-[980px] w-full text-sm">
                            <thead className="bg-gray-50 text-left text-gray-500">
                              <tr>
                                <th className="px-4 py-3 font-medium">When</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Lead / Click</th>
                                <th className="px-4 py-3 font-medium">Source</th>
                                <th className="px-4 py-3 font-medium">Revenue</th>
                                <th className="px-4 py-3 font-medium">Cost</th>
                                <th className="px-4 py-3 font-medium">Profit</th>
                                <th className="px-4 py-3 font-medium">HTTP</th>
                                <th className="px-4 py-3 font-medium">Publisher Target</th>
                              </tr>
                            </thead>
                            <tbody>
                              {link.conversionPostbacks.map((event) => (
                                <tr key={event.id} className="border-t border-gray-100 align-top">
                                  <td className="px-4 py-4 text-gray-700">{formatDate(event.createdAt)}</td>
                                  <td className="px-4 py-4">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(event.status)}`}>
                                      {event.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-gray-700">
                                    <div>{event.leadId ? `Lead ${truncateId(event.leadId)}` : "-"}</div>
                                    <div className="mt-1 text-xs text-gray-500">{event.clickId || "-"}</div>
                                  </td>
                                  <td className="px-4 py-4 text-gray-700">{event.source || event.eventType}</td>
                                  <td className="px-4 py-4 text-gray-700">{toMoney(event.revenue === null || typeof event.revenue === "undefined" ? null : Number(event.revenue))}</td>
                                  <td className="px-4 py-4 text-gray-700">{toMoney(event.cost === null || typeof event.cost === "undefined" ? null : Number(event.cost))}</td>
                                  <td className="px-4 py-4 text-gray-700">{toMoney(event.profit === null || typeof event.profit === "undefined" ? null : Number(event.profit))}</td>
                                  <td className="px-4 py-4 text-gray-700">{event.statusCode ?? "-"}</td>
                                  <td className="px-4 py-4 text-gray-700">
                                    {event.targetUrl ? (
                                      <details>
                                        <summary className="cursor-pointer text-sm font-medium text-blue-600">View target</summary>
                                        <div className="mt-2 break-all rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                                          {event.targetUrl}
                                        </div>
                                        {event.error ? (
                                          <div className="mt-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                                            {event.error}
                                          </div>
                                        ) : null}
                                        {event.responseBody ? (
                                          <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                                            {event.responseBody}
                                          </div>
                                        ) : null}
                                      </details>
                                    ) : (
                                      <span className="text-gray-400">No outbound publisher URL</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                          No conversion postbacks have been recorded for this link yet. Once Everflow or another source hits the sold endpoint, the latest attempts will show up here.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
