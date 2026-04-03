"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Buyer = {
  id: string;
  organizationId: string;
  name: string;
  companyName?: string | null;
  contactName?: string | null;
  email?: string | null;
  webhookUrl?: string | null;
  pingUrl?: string | null;
  postUrl?: string | null;
  timeoutMs?: number | null;
  minBid?: string | number | null;
  status: string;
  pricePerLead?: string | number | null;
  dailyCap?: number | null;
  acceptedStates?: string | null;
  requiredFields?: string | null;
  notes?: string | null;
  acceptanceMode?: string | null;
  acceptancePath?: string | null;
  acceptanceValue?: string | null;
  payoutPath?: string | null;
};

type BuyerDraft = {
  name: string;
  companyName: string;
  contactName: string;
  email: string;
  webhookUrl: string;
  pingUrl: string;
  postUrl: string;
  timeoutMs: string;
  minBid: string;
  status: string;
  pricePerLead: string;
  dailyCap: string;
  acceptedStates: string;
  requiredFields: string;
  notes: string;
  acceptanceMode: string;
  acceptancePath: string;
  acceptanceValue: string;
  payoutPath: string;
};

type NewBuyerForm = {
  name: string;
  companyName: string;
  contactName: string;
  email: string;
  webhookUrl: string;
  pingUrl: string;
  postUrl: string;
  timeoutMs: string;
  minBid: string;
  status: string;
  pricePerLead: string;
  dailyCap: string;
  acceptedStates: string;
  requiredFields: string;
  notes: string;
  acceptanceMode: string;
  acceptancePath: string;
  acceptanceValue: string;
  payoutPath: string;
};

type TestResult = {
  buyerId: string;
  buyerName: string;
  acceptanceMode: string;
  acceptancePath?: string | null;
  acceptanceValue?: string | null;
  payoutPath?: string | null;
  accepted: boolean;
  payout: number | null;
};

function truncateId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function normalize(value: unknown) {
  return value === null || typeof value === "undefined" ? "" : String(value);
}

function statusBadgeClass(status: string) {
  return status === "active"
    ? "bg-green-100 text-green-700"
    : "bg-yellow-100 text-yellow-700";
}

export default function BuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedNoticeById, setSavedNoticeById] = useState<Record<string, string>>(
    {}
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [expandedBuyerId, setExpandedBuyerId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, BuyerDraft>>({});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [testPayloads, setTestPayloads] = useState<Record<string, string>>({});
  const [testLoadingId, setTestLoadingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});

  const [newBuyer, setNewBuyer] = useState<NewBuyerForm>({
    name: "",
    companyName: "",
    contactName: "",
    email: "",
    webhookUrl: "",
    pingUrl: "",
    postUrl: "",
    timeoutMs: "1500",
    minBid: "",
    status: "active",
    pricePerLead: "",
    dailyCap: "",
    acceptedStates: "",
    requiredFields: "",
    notes: "",
    acceptanceMode: "standard",
    acceptancePath: "",
    acceptanceValue: "",
    payoutPath: "",
  });

  async function fetchBuyers() {
    const res = await fetch("/api/buyers");
    const data = await res.json();
    const buyerData = data.data || [];

    setBuyers(buyerData);

    const nextDrafts: Record<string, BuyerDraft> = {};
    const nextTestPayloads: Record<string, string> = {};

    buyerData.forEach((buyer: Buyer) => {
      nextDrafts[buyer.id] = {
        name: buyer.name || "",
        companyName: buyer.companyName || "",
        contactName: buyer.contactName || "",
        email: buyer.email || "",
        webhookUrl: buyer.webhookUrl || "",
        pingUrl: buyer.pingUrl || "",
        postUrl: buyer.postUrl || "",
        timeoutMs:
          buyer.timeoutMs !== null && typeof buyer.timeoutMs !== "undefined"
            ? String(buyer.timeoutMs)
            : "1500",
        minBid:
          buyer.minBid !== null && typeof buyer.minBid !== "undefined"
            ? String(buyer.minBid)
            : "",
        status: buyer.status,
        pricePerLead:
          buyer.pricePerLead !== null &&
          typeof buyer.pricePerLead !== "undefined"
            ? String(buyer.pricePerLead)
            : "",
        dailyCap:
          buyer.dailyCap !== null && typeof buyer.dailyCap !== "undefined"
            ? String(buyer.dailyCap)
            : "",
        acceptedStates: buyer.acceptedStates || "",
        requiredFields: buyer.requiredFields || "",
        notes: buyer.notes || "",
        acceptanceMode: buyer.acceptanceMode || "standard",
        acceptancePath: buyer.acceptancePath || "",
        acceptanceValue: buyer.acceptanceValue || "",
        payoutPath: buyer.payoutPath || "",
      };

      nextTestPayloads[buyer.id] = JSON.stringify(
        {
          accepted: true,
          status: "accepted",
          payout: 42.5,
        },
        null,
        2
      );
    });

    setDrafts(nextDrafts);
    setTestPayloads((prev) => ({ ...nextTestPayloads, ...prev }));
    setLoading(false);
  }

  useEffect(() => {
    fetchBuyers();
  }, []);

  function updateDraft(id: string, field: keyof BuyerDraft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  function updateNewBuyer(field: keyof NewBuyerForm, value: string) {
    setNewBuyer((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function updateTestPayload(id: string, value: string) {
    setTestPayloads((prev) => ({
      ...prev,
      [id]: value,
    }));
  }

  async function createBuyer(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!newBuyer.name.trim()) {
      setCreateError("Buyer name is required.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch("/api/buyers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newBuyer.name,
          companyName: newBuyer.companyName || null,
          contactName: newBuyer.contactName || null,
          email: newBuyer.email || null,
          webhookUrl: newBuyer.webhookUrl || null,
          pingUrl: newBuyer.pingUrl || null,
          postUrl: newBuyer.postUrl || null,
          timeoutMs:
            newBuyer.timeoutMs === "" ? null : Number(newBuyer.timeoutMs),
          minBid: newBuyer.minBid === "" ? null : Number(newBuyer.minBid),
          status: newBuyer.status,
          pricePerLead:
            newBuyer.pricePerLead === "" ? null : Number(newBuyer.pricePerLead),
          dailyCap:
            newBuyer.dailyCap === "" ? null : Number(newBuyer.dailyCap),
          acceptedStates: newBuyer.acceptedStates || null,
          requiredFields: newBuyer.requiredFields || null,
          notes: newBuyer.notes || null,
          acceptanceMode: newBuyer.acceptanceMode || "standard",
          acceptancePath: newBuyer.acceptancePath || null,
          acceptanceValue: newBuyer.acceptanceValue || null,
          payoutPath: newBuyer.payoutPath || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create buyer");
      }

      setCreateSuccess("Buyer created successfully.");

      setNewBuyer({
        name: "",
        companyName: "",
        contactName: "",
        email: "",
        webhookUrl: "",
        pingUrl: "",
        postUrl: "",
        timeoutMs: "1500",
        minBid: "",
        status: "active",
        pricePerLead: "",
        dailyCap: "",
        acceptedStates: "",
        requiredFields: "",
        notes: "",
        acceptanceMode: "standard",
        acceptancePath: "",
        acceptanceValue: "",
        payoutPath: "",
      });

      await fetchBuyers();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create buyer");
    } finally {
      setCreating(false);
    }
  }

  async function saveBuyer(id: string) {
    const draft = drafts[id];
    if (!draft) return;

    try {
      setSavingId(id);

      const res = await fetch(`/api/buyers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          timeoutMs: draft.timeoutMs === "" ? null : Number(draft.timeoutMs),
          minBid: draft.minBid === "" ? null : Number(draft.minBid),
          pricePerLead:
            draft.pricePerLead === "" ? null : Number(draft.pricePerLead),
          dailyCap: draft.dailyCap === "" ? null : Number(draft.dailyCap),
          acceptancePath: draft.acceptancePath || null,
          acceptanceValue: draft.acceptanceValue || null,
          payoutPath: draft.payoutPath || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update buyer");
      }

      await fetchBuyers();
      showSavedNotice(id, "Buyer settings saved.");
    } catch (err) {
      console.error("Buyer save error:", err);
    } finally {
      setSavingId(null);
    }
  }

  function showSavedNotice(buyerId: string, message: string) {
    setSavedNoticeById((prev) => ({
      ...prev,
      [buyerId]: message,
    }));

    window.setTimeout(() => {
      setSavedNoticeById((prev) => {
        if (prev[buyerId] !== message) return prev;
        const next = { ...prev };
        delete next[buyerId];
        return next;
      });
    }, 2500);
  }

  async function runResponseTest(id: string) {
    try {
      setTestLoadingId(id);
      setTestErrors((prev) => ({ ...prev, [id]: "" }));

      let responseBody: any;
      try {
        responseBody = JSON.parse(testPayloads[id] || "{}");
      } catch {
        throw new Error("Test payload must be valid JSON");
      }

      const res = await fetch(`/api/buyers/${id}/test-response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ responseBody }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to run response test");
      }

      setTestResults((prev) => ({
        ...prev,
        [id]: json.data,
      }));
    } catch (err: any) {
      setTestErrors((prev) => ({
        ...prev,
        [id]: err?.message || "Failed to run response test",
      }));
    } finally {
      setTestLoadingId(null);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error("Clipboard error:", err);
    }
  }

  function isDirty(buyer: Buyer) {
    const draft = drafts[buyer.id];
    if (!draft) return false;

    return (
      draft.name !== normalize(buyer.name) ||
      draft.companyName !== normalize(buyer.companyName) ||
      draft.contactName !== normalize(buyer.contactName) ||
      draft.email !== normalize(buyer.email) ||
      draft.webhookUrl !== normalize(buyer.webhookUrl) ||
      draft.pingUrl !== normalize(buyer.pingUrl) ||
      draft.postUrl !== normalize(buyer.postUrl) ||
      draft.timeoutMs !== normalize(buyer.timeoutMs ?? "1500") ||
      draft.minBid !== normalize(buyer.minBid) ||
      draft.status !== normalize(buyer.status) ||
      draft.pricePerLead !== normalize(buyer.pricePerLead) ||
      draft.dailyCap !== normalize(buyer.dailyCap) ||
      draft.acceptedStates !== normalize(buyer.acceptedStates) ||
      draft.requiredFields !== normalize(buyer.requiredFields) ||
      draft.notes !== normalize(buyer.notes) ||
      draft.acceptanceMode !== normalize(buyer.acceptanceMode || "standard") ||
      draft.acceptancePath !== normalize(buyer.acceptancePath) ||
      draft.acceptanceValue !== normalize(buyer.acceptanceValue) ||
      draft.payoutPath !== normalize(buyer.payoutPath)
    );
  }

  const filteredBuyers = useMemo(() => {
    const searchLower = search.toLowerCase().trim();

    return buyers.filter((buyer) => {
      const matchesSearch =
        searchLower === "" ||
        buyer.id.toLowerCase().includes(searchLower) ||
        (buyer.name || "").toLowerCase().includes(searchLower) ||
        (buyer.companyName || "").toLowerCase().includes(searchLower) ||
        (buyer.contactName || "").toLowerCase().includes(searchLower) ||
        (buyer.email || "").toLowerCase().includes(searchLower);

      const matchesStatus =
        statusFilter === "all" || buyer.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [buyers, search, statusFilter]);

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading buyers...</div>;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Buyers
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Buyer Management
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage buyer onboarding, commercial terms, ping/post endpoints, response parsing, and daily caps.
          </p>
        </div>

        <div className="p-6">
          <form
            onSubmit={createBuyer}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  New Buyer
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Add a buyer and define how Lead OS should interpret responses and cap daily volume.
                </p>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Buyer"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Buyer Name
                </label>
                <input
                  value={newBuyer.name}
                  onChange={(e) => updateNewBuyer("name", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Required"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Company Name
                </label>
                <input
                  value={newBuyer.companyName}
                  onChange={(e) => updateNewBuyer("companyName", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Contact Name
                </label>
                <input
                  value={newBuyer.contactName}
                  onChange={(e) => updateNewBuyer("contactName", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  value={newBuyer.email}
                  onChange={(e) => updateNewBuyer("email", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={newBuyer.status}
                  onChange={(e) => updateNewBuyer("status", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Price Per Lead
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newBuyer.pricePerLead}
                  onChange={(e) => updateNewBuyer("pricePerLead", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Minimum Bid
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newBuyer.minBid}
                  onChange={(e) => updateNewBuyer("minBid", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Daily Cap
                </label>
                <input
                  type="number"
                  step="1"
                  value={newBuyer.dailyCap}
                  onChange={(e) => updateNewBuyer("dailyCap", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="No cap"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Timeout (ms)
                </label>
                <input
                  type="number"
                  step="1"
                  value={newBuyer.timeoutMs}
                  onChange={(e) => updateNewBuyer("timeoutMs", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Ping URL
                </label>
                <input
                  value={newBuyer.pingUrl}
                  onChange={(e) => updateNewBuyer("pingUrl", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Post URL
                </label>
                <input
                  value={newBuyer.postUrl}
                  onChange={(e) => updateNewBuyer("postUrl", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Legacy Webhook URL
                </label>
                <input
                  value={newBuyer.webhookUrl}
                  onChange={(e) => updateNewBuyer("webhookUrl", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Accepted States
                </label>
                <input
                  value={newBuyer.acceptedStates}
                  onChange={(e) => updateNewBuyer("acceptedStates", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="NY, FL, CA"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Required Fields
                </label>
                <input
                  value={newBuyer.requiredFields}
                  onChange={(e) => updateNewBuyer("requiredFields", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="firstName,lastName,phone,state,zip"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Acceptance Mode
                </label>
                <select
                  value={newBuyer.acceptanceMode}
                  onChange={(e) => updateNewBuyer("acceptanceMode", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="standard">standard</option>
                  <option value="path_equals">path_equals</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Acceptance Path
                </label>
                <input
                  value={newBuyer.acceptancePath}
                  onChange={(e) => updateNewBuyer("acceptancePath", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="status or result.success"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Acceptance Value
                </label>
                <input
                  value={newBuyer.acceptanceValue}
                  onChange={(e) => updateNewBuyer("acceptanceValue", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="accepted / true / 1"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Payout Path
                </label>
                <input
                  value={newBuyer.payoutPath}
                  onChange={(e) => updateNewBuyer("payoutPath", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="payout or data.amount"
                />
              </div>

              <div className="md:col-span-3">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={newBuyer.notes}
                  onChange={(e) => updateNewBuyer("notes", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  rows={3}
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

          <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                type="text"
                placeholder="Buyer ID, name, company, contact, email..."
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

            <div className="flex items-end text-sm text-gray-500">
              Showing {filteredBuyers.length} of {buyers.length} buyers
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1350px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Buyer ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">PPL</th>
                <th className="px-4 py-3 font-medium">Daily Cap</th>
                <th className="px-4 py-3 font-medium">Min Bid</th>
                <th className="px-4 py-3 font-medium">Timeout</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredBuyers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-500">
                    No buyers found.
                  </td>
                </tr>
              ) : (
                filteredBuyers.map((buyer) => {
                  const isExpanded = expandedBuyerId === buyer.id;
                  const draft = drafts[buyer.id];
                  const testResult = testResults[buyer.id];
                  const testError = testErrors[buyer.id];

                  return (
                    <Fragment key={buyer.id}>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <button
                            onClick={() =>
                              setExpandedBuyerId(isExpanded ? null : buyer.id)
                            }
                            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            {isExpanded ? "−" : "+"}
                          </button>
                        </td>

                        <td className="px-4 py-4 font-medium text-blue-700">
                          {truncateId(buyer.id)}
                        </td>

                        <td className="px-4 py-4 font-medium text-gray-900">
                          {buyer.name}
                        </td>

                        <td className="px-4 py-4">{buyer.companyName || "—"}</td>
                        <td className="px-4 py-4">{buyer.contactName || "—"}</td>
                        <td className="px-4 py-4">{buyer.email || "—"}</td>

                        <td className="px-4 py-4">
                          {buyer.pricePerLead
                            ? `$${Number(buyer.pricePerLead).toFixed(2)}`
                            : "—"}
                        </td>

                        <td className="px-4 py-4">
                          {buyer.dailyCap ?? "—"}
                        </td>

                        <td className="px-4 py-4">
                          {buyer.minBid ? `$${Number(buyer.minBid).toFixed(2)}` : "—"}
                        </td>

                        <td className="px-4 py-4">{buyer.timeoutMs ?? "—"}</td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                              buyer.status
                            )}`}
                          >
                            {buyer.status}
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <td colSpan={11} className="px-6 py-6">
                            <div className="grid gap-6 xl:grid-cols-3">
                              <div className="space-y-3 xl:col-span-2">
                                <h3 className="text-sm font-semibold text-gray-800">
                                  Buyer Settings
                                </h3>

                                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                      <div>
                                        <div className="text-sm font-semibold text-gray-900">
                                          Commercial + Routing Setup
                                        </div>
                                        <div className="mt-1 text-sm text-gray-500">
                                          Keep contact details, pricing, caps, endpoints, and response parsing rules aligned for this buyer.
                                        </div>
                                      </div>

                                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                                        <div className="font-semibold">Buyer Snapshot</div>
                                        <div className="mt-1">
                                          Current PPL:{" "}
                                          {draft?.pricePerLead
                                            ? `$${Number(draft.pricePerLead).toFixed(2)}`
                                            : "not set"}
                                          {" | "}Daily Cap: {draft?.dailyCap || "none"}
                                          {" | "}Mode: {draft?.acceptanceMode || "standard"}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {savedNoticeById[buyer.id] ? (
                                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                                      {savedNoticeById[buyer.id]}
                                    </div>
                                  ) : null}

                                  <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Buyer Name
                                      </label>
                                      <input
                                        value={draft?.name || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "name", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Company Name
                                      </label>
                                      <input
                                        value={draft?.companyName || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "companyName", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Contact Name
                                      </label>
                                      <input
                                        value={draft?.contactName || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "contactName", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Email
                                      </label>
                                      <input
                                        value={draft?.email || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "email", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Status
                                      </label>
                                      <select
                                        value={draft?.status || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "status", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      >
                                        <option value="active">active</option>
                                        <option value="paused">paused</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Price Per Lead
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={draft?.pricePerLead || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "pricePerLead", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Daily Cap
                                      </label>
                                      <input
                                        type="number"
                                        step="1"
                                        value={draft?.dailyCap || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "dailyCap", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                        placeholder="No cap"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Minimum Bid
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={draft?.minBid || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "minBid", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Timeout (ms)
                                      </label>
                                      <input
                                        type="number"
                                        step="1"
                                        value={draft?.timeoutMs || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "timeoutMs", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Accepted States
                                      </label>
                                      <input
                                        value={draft?.acceptedStates || ""}
                                        placeholder="NY, FL, CA"
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "acceptedStates", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div className="md:col-span-3">
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Required Fields
                                      </label>
                                      <textarea
                                        value={draft?.requiredFields || ""}
                                        placeholder="firstName,lastName,phone,state,zip"
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "requiredFields", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                        rows={2}
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Ping URL
                                      </label>
                                      <input
                                        value={draft?.pingUrl || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "pingUrl", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Post URL
                                      </label>
                                      <input
                                        value={draft?.postUrl || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "postUrl", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Legacy Webhook URL
                                      </label>
                                      <input
                                        value={draft?.webhookUrl || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "webhookUrl", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Acceptance Mode
                                      </label>
                                      <select
                                        value={draft?.acceptanceMode || "standard"}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "acceptanceMode", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      >
                                        <option value="standard">standard</option>
                                        <option value="path_equals">path_equals</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Acceptance Path
                                      </label>
                                      <input
                                        value={draft?.acceptancePath || ""}
                                        placeholder="status or result.success"
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "acceptancePath", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Acceptance Value
                                      </label>
                                      <input
                                        value={draft?.acceptanceValue || ""}
                                        placeholder="accepted / true / 1"
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "acceptanceValue", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Payout Path
                                      </label>
                                      <input
                                        value={draft?.payoutPath || ""}
                                        placeholder="payout or data.amount"
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "payoutPath", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div className="md:col-span-2">
                                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                                        <div className="font-semibold">Response parsing</div>
                                        <div className="mt-1">
                                          <strong>standard</strong> uses built-in parsing like
                                          accepted/success/status.
                                        </div>
                                        <div className="mt-1">
                                          <strong>path_equals</strong> checks whether the value at
                                          a JSON path exactly matches the configured acceptance value.
                                        </div>
                                      </div>
                                    </div>

                                    <div className="md:col-span-3">
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Notes
                                      </label>
                                      <textarea
                                        value={draft?.notes || ""}
                                        onChange={(e) =>
                                          updateDraft(buyer.id, "notes", e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                        rows={3}
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-5 flex items-center gap-3">
                                    <button
                                      onClick={() => saveBuyer(buyer.id)}
                                      disabled={!isDirty(buyer) || savingId === buyer.id}
                                      className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {savingId === buyer.id ? "Saving..." : "Save"}
                                    </button>

                                    {isDirty(buyer) && savingId !== buyer.id && (
                                      <span className="text-sm text-amber-600">
                                        Unsaved changes
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                  <div className="mb-4">
                                    <h3 className="text-sm font-semibold text-gray-800">
                                      Buyer Response Test Panel
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                      Paste a sample buyer JSON response and test whether the
                                      current parsing rules would mark it accepted and extract payout.
                                    </p>
                                  </div>

                                  <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                                    <div className="font-semibold">Safe Validation Step</div>
                                    <div className="mt-1">
                                      Use this before sending live traffic so you can verify acceptance rules and payout parsing against real sample responses.
                                    </div>
                                  </div>

                                  <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Sample Response JSON
                                  </label>
                                  <textarea
                                    value={testPayloads[buyer.id] || ""}
                                    onChange={(e) =>
                                      updateTestPayload(buyer.id, e.target.value)
                                    }
                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 font-mono text-sm"
                                    rows={10}
                                  />

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                      onClick={() => runResponseTest(buyer.id)}
                                      disabled={testLoadingId === buyer.id}
                                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                                    >
                                      {testLoadingId === buyer.id
                                        ? "Testing..."
                                        : "Run Response Test"}
                                    </button>

                                    <button
                                      onClick={() =>
                                        updateTestPayload(
                                          buyer.id,
                                          JSON.stringify(
                                            {
                                              accepted: true,
                                              status: "accepted",
                                              payout: 42.5,
                                            },
                                            null,
                                            2
                                          )
                                        )
                                      }
                                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      Load Standard Example
                                    </button>

                                    <button
                                      onClick={() =>
                                        updateTestPayload(
                                          buyer.id,
                                          JSON.stringify(
                                            {
                                              status: "accepted",
                                              payout: 42.5,
                                            },
                                            null,
                                            2
                                          )
                                        )
                                      }
                                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      Load Custom Status Example
                                    </button>

                                    <button
                                      onClick={() =>
                                        updateTestPayload(
                                          buyer.id,
                                          JSON.stringify(
                                            {
                                              result: {
                                                decision: "approved",
                                                amount: 55.75,
                                              },
                                            },
                                            null,
                                            2
                                          )
                                        )
                                      }
                                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      Load Nested Example
                                    </button>
                                  </div>

                                  {testError ? (
                                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                      {testError}
                                    </div>
                                  ) : null}

                                  {testResult ? (
                                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                                      <div className="grid gap-3 md:grid-cols-2">
                                        <div>
                                          <span className="font-medium">Mode:</span>{" "}
                                          {testResult.acceptanceMode}
                                        </div>
                                        <div>
                                          <span className="font-medium">Accepted:</span>{" "}
                                          <span
                                            className={
                                              testResult.accepted
                                                ? "font-semibold text-green-700"
                                                : "font-semibold text-red-700"
                                            }
                                          >
                                            {String(testResult.accepted)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="font-medium">Acceptance Path:</span>{" "}
                                          {testResult.acceptancePath || "—"}
                                        </div>
                                        <div>
                                          <span className="font-medium">Acceptance Value:</span>{" "}
                                          {testResult.acceptanceValue || "—"}
                                        </div>
                                        <div>
                                          <span className="font-medium">Payout Path:</span>{" "}
                                          {testResult.payoutPath || "—"}
                                        </div>
                                        <div>
                                          <span className="font-medium">Extracted Payout:</span>{" "}
                                          {testResult.payout === null
                                            ? "—"
                                            : `$${Number(testResult.payout).toFixed(2)}`}
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-800">
                                  Buyer Endpoint Tools
                                </h3>

                                <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm shadow-sm space-y-4">
                                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                    <div className="text-sm font-semibold text-blue-900">
                                      Buyer Handoff
                                    </div>
                                    <div className="mt-2 text-sm text-blue-800">
                                      Copy the live endpoints, review the current parsing config, and generate a buyer spec whenever you need to share integration details.
                                    </div>
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-800">Ping URL</div>
                                    <div className="mt-1 text-xs text-gray-500">
                                      Used for ping/post bidding when this buyer is configured for ping traffic.
                                    </div>
                                    <div className="mt-2 break-all rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                                      {buyer.pingUrl || "—"}
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => copyText(buyer.pingUrl || "")}
                                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    Copy Ping URL
                                  </button>

                                  <div>
                                    <div className="font-medium text-gray-800">Post URL</div>
                                    <div className="mt-1 text-xs text-gray-500">
                                      Used for full lead delivery. Falls back to the legacy webhook URL when needed.
                                    </div>
                                    <div className="mt-2 break-all rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                                      {buyer.postUrl || buyer.webhookUrl || "—"}
                                    </div>
                                  </div>

                                  <button
                                    onClick={() =>
                                      copyText(buyer.postUrl || buyer.webhookUrl || "")
                                    }
                                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    Copy Post URL
                                  </button>

                                  <Link
                                    href={`/buyer-specs?buyerId=${buyer.id}`}
                                    className="block rounded-xl bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white"
                                  >
                                    Generate Buyer Spec
                                  </Link>

                                  <div>
                                    <div className="font-medium text-gray-800">
                                      Current Parsing Config
                                    </div>
                                    <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                                      <div>Mode: {draft?.acceptanceMode || buyer.acceptanceMode || "standard"}</div>
                                      <div>Acceptance Path: {buyer.acceptancePath || "—"}</div>
                                      <div>Acceptance Value: {buyer.acceptanceValue || "—"}</div>
                                      <div>Payout Path: {buyer.payoutPath || "—"}</div>
                                      <div>Daily Cap: {buyer.dailyCap ?? "—"}</div>
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
