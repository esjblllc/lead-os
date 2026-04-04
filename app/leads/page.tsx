"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useToast } from "@/app/components/toast-provider";

type PingResult = {
  id: string;
  status: string;
  bid?: string | number | null;
  won: boolean;
  response?: string | null;
  error?: string | null;
  createdAt: string;
  buyer: {
    id: string;
    name: string;
  };
};

type Lead = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  zip?: string | null;
  source?: string | null;
  subId?: string | null;
  publisherId?: string | null;
  cost?: string | number | null;
  profit?: string | number | null;
  marginPct?: string | number | null;
  routingStatus: string;
  createdAt: string;
  campaign: {
    id: string;
    name: string;
  };
  supplier?: {
    id: string;
    name: string;
  } | null;
  assignedBuyer?: {
    id: string;
    name: string;
    pricePerLead?: string | number | null;
  } | null;
  deliveries: {
    id: string;
    status: string;
    attemptNumber: number;
    statusCode?: number | null;
  }[];
  pingResults: PingResult[];
};

function getPresetStartDate(range: string) {
  const now = new Date();

  if (range === "24h") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return null;
}

function getDateBounds(range: string, fromDate: string, toDate: string) {
  if (fromDate || toDate) {
    return {
      startDate: fromDate ? new Date(`${fromDate}T00:00:00`) : null,
      endDate: toDate ? new Date(`${toDate}T23:59:59.999`) : null,
    };
  }

  return {
    startDate: getPresetStartDate(range),
    endDate: null,
  };
}

function toNumber(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function currency(value: number | null) {
  return value === null ? "—" : `$${value.toFixed(2)}`;
}

function truncateId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function statusBadgeClass(status: string) {
  if (status === "assigned") return "bg-green-100 text-green-700";
  if (status === "pending") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

function pingStatusBadgeClass(status: string) {
  if (status === "accepted") return "bg-green-100 text-green-700";
  if (status === "rejected") return "bg-gray-100 text-gray-700";
  if (status === "timeout") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

export default function LeadsPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [buyerFilter, setBuyerFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function fetchLeads() {
    try {
      const res = await fetch("/api/leads");
      if (!res.ok) throw new Error("Failed to fetch leads");
      const json = await res.json();
      setLeads(json.data || []);
    } catch (err) {
      console.error("Fetch error:", err);
      toast({
        title: "Could not load leads",
        description: "Refresh the page and try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();
  }, []);

  const buyerOptions = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((lead) => {
      if (lead.assignedBuyer?.id && lead.assignedBuyer?.name) {
        map.set(lead.assignedBuyer.id, lead.assignedBuyer.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [leads]);

  const campaignOptions = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((lead) => {
      if (lead.campaign?.id && lead.campaign?.name) {
        map.set(lead.campaign.id, lead.campaign.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [leads]);

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((lead) => {
      if (lead.supplier?.id && lead.supplier?.name) {
        map.set(lead.supplier.id, lead.supplier.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const { startDate, endDate } = getDateBounds(dateRange, fromDate, toDate);
    const searchLower = search.toLowerCase().trim();

    return leads.filter((lead) => {
      const fullName = `${lead.firstName || ""} ${lead.lastName || ""}`.toLowerCase();

      const matchesSearch =
        searchLower === "" ||
        lead.id.toLowerCase().includes(searchLower) ||
        fullName.includes(searchLower) ||
        (lead.email || "").toLowerCase().includes(searchLower) ||
        (lead.phone || "").toLowerCase().includes(searchLower) ||
        (lead.source || "").toLowerCase().includes(searchLower) ||
        (lead.subId || "").toLowerCase().includes(searchLower) ||
        (lead.publisherId || "").toLowerCase().includes(searchLower) ||
        (lead.campaign?.name || "").toLowerCase().includes(searchLower) ||
        (lead.assignedBuyer?.name || "").toLowerCase().includes(searchLower) ||
        (lead.supplier?.name || "").toLowerCase().includes(searchLower);

      const matchesStatus =
        statusFilter === "all" || lead.routingStatus === statusFilter;

      const matchesBuyer =
        buyerFilter === "all" || lead.assignedBuyer?.id === buyerFilter;

      const matchesCampaign =
        campaignFilter === "all" || lead.campaign?.id === campaignFilter;

      const matchesSupplier =
        supplierFilter === "all" || lead.supplier?.id === supplierFilter;

      const leadDate = new Date(lead.createdAt);
      const matchesDate =
        (!startDate || leadDate >= startDate) &&
        (!endDate || leadDate <= endDate);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesBuyer &&
        matchesCampaign &&
        matchesSupplier &&
        matchesDate
      );
    });
  }, [
    leads,
    search,
    statusFilter,
    buyerFilter,
    campaignFilter,
    supplierFilter,
    dateRange,
    fromDate,
    toDate,
  ]);

  function getRevenue(lead: Lead) {
    return toNumber(lead.assignedBuyer?.pricePerLead);
  }

  function getCost(lead: Lead) {
    return toNumber(lead.cost);
  }

  function getProfit(lead: Lead) {
    return toNumber(lead.profit);
  }

  function getMarginPct(lead: Lead) {
    return toNumber(lead.marginPct);
  }

  function applyPresetRange(range: string) {
    setDateRange(range);
    setFromDate("");
    setToDate("");
  }

  function clearCustomRange() {
    setDateRange("all");
    setFromDate("");
    setToDate("");
  }

  function clearAllFilters() {
    setSearch("");
    setStatusFilter("all");
    setBuyerFilter("all");
    setCampaignFilter("all");
    setSupplierFilter("all");
    setDateRange("all");
    setFromDate("");
    setToDate("");
  }

  async function exportVisibleLeads() {
    try {
      setExporting(true);

      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (buyerFilter !== "all") params.set("buyerId", buyerFilter);
      if (campaignFilter !== "all") params.set("campaignId", campaignFilter);
      if (supplierFilter !== "all") params.set("supplierId", supplierFilter);
      if (dateRange !== "all") params.set("range", dateRange);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/leads/export?${params.toString()}`);

      if (!res.ok) {
        throw new Error("Failed to export leads");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const contentDisposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
      const filename = filenameMatch?.[1] || "leads-export.csv";

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({
        title: "Lead export ready",
        description: "The filtered leads CSV has been downloaded.",
        variant: "success",
      });
    } catch (err) {
      console.error("Leads export error:", err);
      toast({
        title: "Lead export failed",
        description: "Please try exporting the visible leads again.",
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  }

  const summary = useMemo(() => {
    const total = filteredLeads.length;
    const assigned = filteredLeads.filter((lead) => lead.routingStatus === "assigned").length;
    const pending = filteredLeads.filter((lead) => lead.routingStatus === "pending").length;
    const totalRevenue = filteredLeads.reduce((sum, lead) => sum + (getRevenue(lead) || 0), 0);
    const totalCost = filteredLeads.reduce((sum, lead) => sum + (getCost(lead) || 0), 0);
    const totalProfit = filteredLeads.reduce((sum, lead) => sum + (getProfit(lead) || 0), 0);

    return { total, assigned, pending, totalRevenue, totalCost, totalProfit };
  }, [filteredLeads]);

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    buyerFilter !== "all" ||
    campaignFilter !== "all" ||
    supplierFilter !== "all" ||
    dateRange !== "all" ||
    fromDate !== "" ||
    toDate !== "";

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading leads...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Leads
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Lead Inventory
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Search, filter, and inspect lead routing, economics, supplier attribution,
                and ping/post outcomes.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportVisibleLeads}
                disabled={exporting}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? "Exporting..." : "Export Visible Leads CSV"}
              </button>
              {[
                { key: "all", label: "All Time" },
                { key: "24h", label: "Last 24h" },
                { key: "7d", label: "Last 7d" },
                { key: "30d", label: "Last 30d" },
              ].map((option) => {
                const isActive = !fromDate && !toDate && dateRange === option.key;

                return (
                  <button
                    key={option.key}
                    onClick={() => applyPresetRange(option.key)}
                    className={
                      isActive
                        ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                        : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5">
            <div className="text-sm font-medium text-gray-500">Visible Leads</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
              {summary.total}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-green-50 p-5">
            <div className="text-sm font-medium text-gray-500">Assigned</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-green-700">
              {summary.assigned}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-yellow-50 p-5">
            <div className="text-sm font-medium text-gray-500">Pending</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-yellow-700">
              {summary.pending}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-blue-50 p-5">
            <div className="text-sm font-medium text-gray-500">Visible Revenue</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-blue-700">
              {currency(summary.totalRevenue)}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50 p-5">
            <div className="text-sm font-medium text-gray-500">Visible Profit</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-indigo-700">
              {currency(summary.totalProfit)}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              Cost: {currency(summary.totalCost)}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 p-6">
          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Workspace Controls
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  Filter the lead inventory, narrow by traffic source or routing outcome, then export exactly what is visible.
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <div className="font-semibold">Current View</div>
                <div className="mt-1">
                  Showing {filteredLeads.length} of {leads.length} leads
                  {hasActiveFilters ? " with filters applied." : "."}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Reset All Filters
                </button>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-2 text-sm text-gray-500">
                  No filters applied.
                </div>
              )}

              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={clearCustomRange}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Clear Custom Dates
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                type="text"
                placeholder="Lead ID, name, email, source, buyer, supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Campaign
              </label>
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All campaigns</option>
                {campaignOptions.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Buyer
              </label>
              <select
                value={buyerFilter}
                onChange={(e) => setBuyerFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All buyers</option>
                {buyerOptions.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>
                    {buyer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Supplier
              </label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All suppliers</option>
                {supplierOptions.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Routing Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="assigned">Assigned</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4 xl:grid-cols-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDateRange("custom");
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDateRange("custom");
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearCustomRange}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Clear Dates
              </button>
            </div>

            <div className="flex items-end text-sm text-gray-500 md:col-span-2 xl:col-span-3">
              Export always uses the same filters you see on screen.
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1400px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Lead ID</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Buyer</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Sub ID</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">Revenue</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Profit</th>
                <th className="px-4 py-3 font-medium">Margin %</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-12 text-center text-gray-500">
                    No leads found.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const revenue = getRevenue(lead);
                  const cost = getCost(lead);
                  const profit = getProfit(lead);
                  const marginPct = getMarginPct(lead);
                  const isExpanded = expandedLeadId === lead.id;

                  return (
                    <Fragment key={lead.id}>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <button
                            onClick={() =>
                              setExpandedLeadId(isExpanded ? null : lead.id)
                            }
                            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            {isExpanded ? "−" : "+"}
                          </button>
                        </td>

                        <td className="px-4 py-4 font-medium text-blue-700">
                          {truncateId(lead.id)}
                        </td>

                        <td className="px-4 py-4 text-gray-500">
                          {new Date(lead.createdAt).toLocaleString()}
                        </td>

                        <td className="px-4 py-4">
                          <div className="font-medium text-gray-900">
                            {lead.firstName || "Unknown"} {lead.lastName || ""}
                          </div>
                          <div className="text-xs text-gray-500">
                            {lead.email || "—"}
                          </div>
                        </td>

                        <td className="px-4 py-4">{lead.campaign?.name || "—"}</td>

                        <td className="px-4 py-4">{lead.supplier?.name || "—"}</td>

                        <td className="px-4 py-4">
                          {lead.assignedBuyer?.name || "Unassigned"}
                        </td>

                        <td className="px-4 py-4">{lead.source || "—"}</td>

                        <td className="px-4 py-4">{lead.subId || "—"}</td>

                        <td className="px-4 py-4">
                          {lead.state || "—"} {lead.zip || ""}
                        </td>

                        <td className="px-4 py-4 text-blue-700">{currency(revenue)}</td>

                        <td className="px-4 py-4 text-orange-700">{currency(cost)}</td>

                        <td className="px-4 py-4 text-green-700">{currency(profit)}</td>

                        <td className="px-4 py-4">
                          {marginPct === null ? "—" : `${marginPct.toFixed(2)}%`}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                              lead.routingStatus
                            )}`}
                          >
                            {lead.routingStatus}
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <td colSpan={15} className="px-6 py-6">
                            <div className="grid gap-6 xl:grid-cols-3">
                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-800">
                                  Lead Details
                                </h3>

                                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-sm space-y-2">
                                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                                    <div className="text-sm font-semibold text-gray-900">
                                      Lead Snapshot
                                    </div>
                                    <div className="mt-2 grid gap-3 md:grid-cols-2 text-sm text-gray-700">
                                      <div>
                                        <span className="font-medium">Routing:</span>{" "}
                                        {lead.routingStatus}
                                      </div>
                                      <div>
                                        <span className="font-medium">Buyer:</span>{" "}
                                        {lead.assignedBuyer?.name || "Unassigned"}
                                      </div>
                                      <div>
                                        <span className="font-medium">Revenue:</span>{" "}
                                        {currency(revenue)}
                                      </div>
                                      <div>
                                        <span className="font-medium">Profit:</span>{" "}
                                        {currency(profit)}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="font-medium">Phone:</span>{" "}
                                    {lead.phone || "—"}
                                  </div>
                                  <div>
                                    <span className="font-medium">Email:</span>{" "}
                                    {lead.email || "—"}
                                  </div>
                                  <div>
                                    <span className="font-medium">Publisher ID:</span>{" "}
                                    {lead.publisherId || "—"}
                                  </div>
                                  <div>
                                    <span className="font-medium">Source:</span>{" "}
                                    {lead.source || "—"}
                                  </div>
                                  <div>
                                    <span className="font-medium">Sub ID:</span>{" "}
                                    {lead.subId || "—"}
                                  </div>
                                  <div>
                                    <span className="font-medium">Supplier:</span>{" "}
                                    {lead.supplier?.name || "—"}
                                  </div>
                                  <div>
                                    <span className="font-medium">Campaign:</span>{" "}
                                    {lead.campaign?.name || "—"}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-800">
                                  Ping Results
                                </h3>

                                {lead.pingResults.length === 0 ? (
                                  <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm">
                                    No ping results.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                                      <div className="font-semibold">Bid Flow</div>
                                      <div className="mt-1">
                                        Review which buyers responded, whether a winner was selected, and what bid values were returned.
                                      </div>
                                    </div>

                                    {lead.pingResults.map((ping) => (
                                      <div
                                        key={ping.id}
                                        className="rounded-2xl border border-gray-200 bg-white p-5 text-sm shadow-sm"
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-medium text-gray-900">
                                            {ping.buyer.name}
                                          </span>

                                          <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${pingStatusBadgeClass(
                                              ping.status
                                            )}`}
                                          >
                                            {ping.status}
                                          </span>

                                          {ping.won && (
                                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                                              winner
                                            </span>
                                          )}
                                        </div>

                                        <div className="mt-3 space-y-1 text-gray-700">
                                          <div>
                                            Bid:{" "}
                                            {ping.bid
                                              ? `$${Number(ping.bid).toFixed(2)}`
                                              : "—"}
                                          </div>
                                          <div>Error: {ping.error || "—"}</div>
                                        </div>

                                        <details className="mt-3">
                                          <summary className="cursor-pointer text-sm font-medium text-blue-600">
                                            View ping response
                                          </summary>
                                          <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                                            {ping.response || "No response"}
                                          </pre>
                                        </details>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-800">
                                  Delivery Attempts
                                </h3>

                                {lead.deliveries.length === 0 ? (
                                  <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm">
                                    No delivery attempts.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                                      <div className="font-semibold">Delivery Timeline</div>
                                      <div className="mt-1">
                                        Track each post attempt, the returned status, and the response code from the buyer side.
                                      </div>
                                    </div>

                                    {lead.deliveries.map((delivery) => (
                                      <div
                                        key={delivery.id}
                                        className="rounded-2xl border border-gray-200 bg-white p-5 text-sm shadow-sm"
                                      >
                                        <div>
                                          <span className="font-medium">Status:</span>{" "}
                                          {delivery.status}
                                        </div>
                                        <div>
                                          <span className="font-medium">Attempt:</span>{" "}
                                          {delivery.attemptNumber}
                                        </div>
                                        <div>
                                          <span className="font-medium">Status Code:</span>{" "}
                                          {delivery.statusCode ?? "—"}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
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
