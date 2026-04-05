"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/app/components/toast-provider";

type Supplier = {
  id: string;
  name: string;
  companyName?: string | null;
  contactName?: string | null;
  email?: string | null;
  trafficSource?: string | null;
  defaultCost?: string | number | null;
  apiKey: string;
  status: string;
  acceptedVerticals?: string | null;
  notes?: string | null;
  organizationId: string;
  createdAt?: string;
  updatedAt?: string;
};

type SupplierDraft = {
  name: string;
  companyName: string;
  contactName: string;
  email: string;
  trafficSource: string;
  defaultCost: string;
  status: string;
  acceptedVerticals: string;
  notes: string;
};

type NewSupplierForm = {
  name: string;
  companyName: string;
  contactName: string;
  email: string;
  trafficSource: string;
  defaultCost: string;
  status: string;
  acceptedVerticals: string;
  notes: string;
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

function formatAuditDate(value?: string) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SuppliersPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedNoticeById, setSavedNoticeById] = useState<Record<string, string>>(
    {}
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(
    null
  );
  const [drafts, setDrafts] = useState<Record<string, SupplierDraft>>({});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [newSupplier, setNewSupplier] = useState<NewSupplierForm>({
    name: "",
    companyName: "",
    contactName: "",
    email: "",
    trafficSource: "",
    defaultCost: "",
    status: "active",
    acceptedVerticals: "",
    notes: "",
  });

  async function fetchSuppliers() {
    try {
      const res = await fetch("/api/suppliers");
      if (!res.ok) {
        throw new Error("Failed to fetch suppliers");
      }

      const data = await res.json();
      const supplierData = data.data || [];

      setSuppliers(supplierData);

      const nextDrafts: Record<string, SupplierDraft> = {};
      supplierData.forEach((supplier: Supplier) => {
        nextDrafts[supplier.id] = {
          name: supplier.name || "",
          companyName: supplier.companyName || "",
          contactName: supplier.contactName || "",
          email: supplier.email || "",
          trafficSource: supplier.trafficSource || "",
          defaultCost:
            supplier.defaultCost !== null &&
            typeof supplier.defaultCost !== "undefined"
              ? String(supplier.defaultCost)
              : "",
          status: supplier.status,
          acceptedVerticals: supplier.acceptedVerticals || "",
          notes: supplier.notes || "",
        };
      });

      setDrafts(nextDrafts);
    } catch (error) {
      console.error("Supplier fetch error:", error);
      toast({
        title: "Could not load suppliers",
        description: "Refresh the page and try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSuppliers();
  }, []);

  function updateDraft(id: string, field: keyof SupplierDraft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  function updateNewSupplier(
    field: keyof NewSupplierForm,
    value: string
  ) {
    setNewSupplier((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function createSupplier(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!newSupplier.name.trim()) {
      setCreateError("Supplier name is required.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newSupplier.name,
          companyName: newSupplier.companyName || null,
          contactName: newSupplier.contactName || null,
          email: newSupplier.email || null,
          trafficSource: newSupplier.trafficSource || null,
          defaultCost:
            newSupplier.defaultCost === ""
              ? null
              : Number(newSupplier.defaultCost),
          status: newSupplier.status,
          acceptedVerticals: newSupplier.acceptedVerticals || null,
          notes: newSupplier.notes || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create supplier");
      }

      setCreateSuccess("Supplier created successfully.");
      toast({
        title: "Supplier created",
        description: `${newSupplier.name} is ready for inbound traffic.`,
        variant: "success",
      });

      setNewSupplier({
        name: "",
        companyName: "",
        contactName: "",
        email: "",
        trafficSource: "",
        defaultCost: "",
        status: "active",
        acceptedVerticals: "",
        notes: "",
      });

      await fetchSuppliers();
    } catch (err: any) {
      const message = err?.message || "Failed to create supplier";
      setCreateError(message);
      toast({
        title: "Supplier creation failed",
        description: message,
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  async function saveSupplier(id: string) {
    const draft = drafts[id];
    if (!draft) return;

    try {
      setSavingId(id);

      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!res.ok) {
        throw new Error("Failed to update supplier");
      }

      await fetchSuppliers();
      showSavedNotice(id, "Supplier settings saved.");
      toast({
        title: "Supplier saved",
        description: "Supplier settings updated successfully.",
        variant: "success",
      });
    } catch (err) {
      console.error("Supplier save error:", err);
      toast({
        title: "Supplier save failed",
        description: "Please try saving this supplier again.",
        variant: "error",
      });
    } finally {
      setSavingId(null);
    }
  }

  function showSavedNotice(supplierId: string, message: string) {
    setSavedNoticeById((prev) => ({
      ...prev,
      [supplierId]: message,
    }));

    window.setTimeout(() => {
      setSavedNoticeById((prev) => {
        if (prev[supplierId] !== message) return prev;
        const next = { ...prev };
        delete next[supplierId];
        return next;
      });
    }, 2500);
  }

  async function regenerateApiKey(id: string) {
    try {
      const res = await fetch(`/api/suppliers/${id}/regenerate-key`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to regenerate API key");
      }

      await fetchSuppliers();
      toast({
        title: "API key regenerated",
        description: "Share the new key with the supplier before they post again.",
        variant: "success",
      });
    } catch (err) {
      console.error("Regenerate API key error:", err);
      toast({
        title: "API key regeneration failed",
        description: "Please try generating a new key again.",
        variant: "error",
      });
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: "Copied to clipboard",
        variant: "info",
      });
    } catch (err) {
      console.error("Clipboard error:", err);
      toast({
        title: "Copy failed",
        description: "Your browser could not copy that value.",
        variant: "error",
      });
    }
  }

  function isDirty(supplier: Supplier) {
    const draft = drafts[supplier.id];
    if (!draft) return false;

    return (
      draft.name !== normalize(supplier.name) ||
      draft.companyName !== normalize(supplier.companyName) ||
      draft.contactName !== normalize(supplier.contactName) ||
      draft.email !== normalize(supplier.email) ||
      draft.trafficSource !== normalize(supplier.trafficSource) ||
      draft.defaultCost !== normalize(supplier.defaultCost) ||
      draft.status !== normalize(supplier.status) ||
      draft.acceptedVerticals !== normalize(supplier.acceptedVerticals) ||
      draft.notes !== normalize(supplier.notes)
    );
  }

  const filteredSuppliers = useMemo(() => {
    const searchLower = search.toLowerCase().trim();

    return suppliers.filter((supplier) => {
      const matchesSearch =
        searchLower === "" ||
        supplier.id.toLowerCase().includes(searchLower) ||
        (supplier.name || "").toLowerCase().includes(searchLower) ||
        (supplier.companyName || "").toLowerCase().includes(searchLower) ||
        (supplier.contactName || "").toLowerCase().includes(searchLower) ||
        (supplier.email || "").toLowerCase().includes(searchLower) ||
        (supplier.trafficSource || "").toLowerCase().includes(searchLower);

      const matchesStatus =
        statusFilter === "all" || supplier.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [suppliers, search, statusFilter]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading suppliers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Suppliers
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Supplier Management
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage supplier onboarding, traffic sources, default cost, API keys,
            and inbound posting specs.
          </p>
        </div>

        <div className="p-6">
          <form
            onSubmit={createSupplier}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  New Supplier
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Add a new inbound traffic source and generate posting credentials.
                </p>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Supplier"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Supplier Name
                </label>
                <input
                  value={newSupplier.name}
                  onChange={(e) => updateNewSupplier("name", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Required"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Company Name
                </label>
                <input
                  value={newSupplier.companyName}
                  onChange={(e) =>
                    updateNewSupplier("companyName", e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Contact Name
                </label>
                <input
                  value={newSupplier.contactName}
                  onChange={(e) =>
                    updateNewSupplier("contactName", e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  value={newSupplier.email}
                  onChange={(e) => updateNewSupplier("email", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Traffic Source
                </label>
                <input
                  value={newSupplier.trafficSource}
                  onChange={(e) =>
                    updateNewSupplier("trafficSource", e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="facebook, google, native"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Default Cost
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newSupplier.defaultCost}
                  onChange={(e) =>
                    updateNewSupplier("defaultCost", e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={newSupplier.status}
                  onChange={(e) => updateNewSupplier("status", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Accepted Verticals
                </label>
                <input
                  value={newSupplier.acceptedVerticals}
                  onChange={(e) =>
                    updateNewSupplier("acceptedVerticals", e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="legal, insurance, home services"
                />
              </div>

              <div className="md:col-span-3">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={newSupplier.notes}
                  onChange={(e) => updateNewSupplier("notes", e.target.value)}
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
                placeholder="Supplier ID, name, company, contact, email, source..."
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
              Showing {filteredSuppliers.length} of {suppliers.length} suppliers
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1300px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Supplier ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Traffic Source</th>
                <th className="px-4 py-3 font-medium">Default Cost</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No suppliers found.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => {
                  const isExpanded = expandedSupplierId === supplier.id;
                  const draft = drafts[supplier.id];

                  return (
                    <Fragment key={supplier.id}>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <button
                            onClick={() =>
                              setExpandedSupplierId(
                                isExpanded ? null : supplier.id
                              )
                            }
                            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            {isExpanded ? "−" : "+"}
                          </button>
                        </td>

                        <td className="px-4 py-4 font-medium text-blue-700">
                          {truncateId(supplier.id)}
                        </td>

                        <td className="px-4 py-4 font-medium text-gray-900">
                          {supplier.name}
                        </td>

                        <td className="px-4 py-4">
                          {supplier.companyName || "—"}
                        </td>

                        <td className="px-4 py-4">
                          {supplier.contactName || "—"}
                        </td>

                        <td className="px-4 py-4">
                          {supplier.email || "—"}
                        </td>

                        <td className="px-4 py-4">
                          {supplier.trafficSource || "—"}
                        </td>

                        <td className="px-4 py-4">
                          {supplier.defaultCost
                            ? `$${Number(supplier.defaultCost).toFixed(2)}`
                            : "—"}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                              supplier.status
                            )}`}
                          >
                            {supplier.status}
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <td colSpan={9} className="px-6 py-6">
                            <div className="grid gap-6 xl:grid-cols-3">
                              <div className="space-y-3 xl:col-span-2">
                                <h3 className="text-sm font-semibold text-gray-800">
                                  Supplier Settings
                                </h3>

                                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                      <div>
                                        <div className="text-sm font-semibold text-gray-900">
                                          Supplier Details
                                        </div>
                                        <div className="mt-1 text-sm text-gray-500">
                                          Keep contact information, traffic source defaults, and supplier status current.
                                        </div>
                                      </div>

                                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                                        <div className="font-semibold">Live Posting Summary</div>
                                        <div className="mt-1">
                                          RouteIQ will authenticate this source by API key and apply the default cost when the publisher does not send one.
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {savedNoticeById[supplier.id] ? (
                                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                                      {savedNoticeById[supplier.id]}
                                    </div>
                                  ) : null}

                                  <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Supplier Name
                                      </label>
                                      <input
                                        value={draft?.name || ""}
                                        onChange={(e) =>
                                          updateDraft(
                                            supplier.id,
                                            "name",
                                            e.target.value
                                          )
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
                                          updateDraft(
                                            supplier.id,
                                            "companyName",
                                            e.target.value
                                          )
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
                                          updateDraft(
                                            supplier.id,
                                            "contactName",
                                            e.target.value
                                          )
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
                                          updateDraft(
                                            supplier.id,
                                            "email",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Traffic Source
                                      </label>
                                      <input
                                        value={draft?.trafficSource || ""}
                                        placeholder="facebook, google, native"
                                        onChange={(e) =>
                                          updateDraft(
                                            supplier.id,
                                            "trafficSource",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Default Cost
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={draft?.defaultCost || ""}
                                        onChange={(e) =>
                                          updateDraft(
                                            supplier.id,
                                            "defaultCost",
                                            e.target.value
                                          )
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
                                          updateDraft(
                                            supplier.id,
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

                                    <div className="md:col-span-2">
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Accepted Verticals
                                      </label>
                                      <input
                                        value={draft?.acceptedVerticals || ""}
                                        placeholder="legal, insurance, home services"
                                        onChange={(e) =>
                                          updateDraft(
                                            supplier.id,
                                            "acceptedVerticals",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>

                                    <div className="md:col-span-3">
                                      <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Notes
                                      </label>
                                      <textarea
                                        value={draft?.notes || ""}
                                        onChange={(e) =>
                                          updateDraft(
                                            supplier.id,
                                            "notes",
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
                                      onClick={() => saveSupplier(supplier.id)}
                                      disabled={
                                        !isDirty(supplier) ||
                                        savingId === supplier.id
                                      }
                                      className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {savingId === supplier.id
                                        ? "Saving..."
                                        : "Save"}
                                    </button>

                                    {isDirty(supplier) &&
                                      savingId !== supplier.id && (
                                        <span className="text-sm text-amber-600">
                                          Unsaved changes
                                        </span>
                                      )}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-800">
                                  Inbound Posting
                                </h3>

                                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-sm space-y-4">
                                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                    <div className="text-sm font-semibold text-blue-900">
                                      Publisher Handoff
                                    </div>
                                    <div className="mt-2 text-sm text-blue-800">
                                      Share the API key, endpoint, and campaign-specific inbound spec so this supplier can start posting with the right format.
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-medium text-gray-800">
                                      API Key
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                      This identifies the supplier on every inbound lead request.
                                    </div>
                                    <div className="mt-2 break-all rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                                      {supplier.apiKey}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() =>
                                        regenerateApiKey(supplier.id)
                                      }
                                      className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white"
                                    >
                                      Regenerate API Key
                                    </button>

                                    <button
                                      onClick={() => copyText(supplier.apiKey)}
                                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      Copy API Key
                                    </button>
                                  </div>

                                  <div>
                                    <div className="font-medium text-gray-800">
                                      Inbound Endpoint
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                      Publishers should send POST requests here with the supplier API key in the header.
                                    </div>
                                    <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-700 break-all">
                                      /api/inbound/leads
                                    </div>
                                  </div>

                                  <button
                                    onClick={() =>
                                      copyText("/api/inbound/leads")
                                    }
                                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    Copy Endpoint
                                  </button>

                                  <Link
                                    href={`/inbound?supplierId=${supplier.id}`}
                                    className="block rounded-xl bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white"
                                  >
                                    Generate Supplier Spec
                                  </Link>

                                  <div>
                                    <div className="font-medium text-gray-800">
                                      Authentication Header
                                    </div>
                                    <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-700 break-all">
                                      x-api-key: {supplier.apiKey}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-medium text-gray-800">
                                      Audit Trail
                                    </div>
                                    <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                                      <div>Created: {formatAuditDate(supplier.createdAt)}</div>
                                      <div>Last Updated: {formatAuditDate(supplier.updatedAt)}</div>
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-medium text-gray-800">
                                      Sample Payload
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                      This is the baseline payload. Campaign-specific required fields will appear on the generated supplier spec page.
                                    </div>
                                    <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
{`{
  "campaignSlug": "your-campaign-slug",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "5551234567",
  "state": "NY",
  "zip": "11746",
  "source": "facebook",
  "subId": "sub_123",
  "publisherId": "pub_123"
}`}
                                    </pre>
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
