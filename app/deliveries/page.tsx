"use client";

import { useEffect, useMemo, useState } from "react";

type Delivery = {
  id: string;
  status: string;
  response?: string | null;
  statusCode?: number | null;
  attemptNumber: number;
  createdAt: string;
  lead: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  buyer: {
    id: string;
    name: string;
    email?: string | null;
    webhookUrl?: string | null;
  };
};

function getPresetStartDate(range: string) {
  const now = new Date();

  if (range === "24h") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  if (range === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (range === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

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

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [dateRange, setDateRange] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function fetchDeliveries() {
    const res = await fetch("/api/deliveries");
    const data = await res.json();
    setDeliveries(data.data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchDeliveries();
  }, []);

  async function retryDelivery(id: string) {
    try {
      setRetryingId(id);

      await fetch(`/api/deliveries/${id}/retry`, {
        method: "POST",
      });

      await fetchDeliveries();
    } finally {
      setRetryingId(null);
    }
  }

  const filteredDeliveries = useMemo(() => {
    const { startDate, endDate } = getDateBounds(dateRange, fromDate, toDate);

    return deliveries.filter((delivery) => {
      const matchesStatus =
        statusFilter === "all" || delivery.status === statusFilter;

      const deliveryDate = new Date(delivery.createdAt);

      const matchesDate =
        (!startDate || deliveryDate >= startDate) &&
        (!endDate || deliveryDate <= endDate);

      return matchesStatus && matchesDate;
    });
  }, [deliveries, statusFilter, dateRange, fromDate, toDate]);

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

  if (loading) {
    return <div className="p-6">Loading deliveries...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold">Deliveries</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monitor buyer delivery attempts, responses, retries, and date-filtered activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "All Time" },
            { key: "24h", label: "Last 24h" },
            { key: "7d", label: "Last 7d" },
            { key: "30d", label: "Last 30d" },
          ].map((option) => {
            const isActive =
              !fromDate && !toDate && dateRange === option.key;

            return (
              <button
                key={option.key}
                onClick={() => applyPresetRange(option.key)}
                className={
                  isActive
                    ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150"
                    : "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end gap-3 md:col-span-2">
              <button
                type="button"
                onClick={clearCustomRange}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Clear Dates
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg border px-4 py-2 text-sm ${
              statusFilter === "all"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 bg-white hover:bg-gray-100"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter("success")}
            className={`rounded-lg border px-4 py-2 text-sm ${
              statusFilter === "success"
                ? "border-green-700 bg-green-700 text-white"
                : "border-gray-300 bg-white hover:bg-gray-100"
            }`}
          >
            Success
          </button>
          <button
            onClick={() => setStatusFilter("failed")}
            className={`rounded-lg border px-4 py-2 text-sm ${
              statusFilter === "failed"
                ? "border-red-700 bg-red-700 text-white"
                : "border-gray-300 bg-white hover:bg-gray-100"
            }`}
          >
            Failed
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Showing {filteredDeliveries.length} of {deliveries.length} deliveries
      </div>

      {filteredDeliveries.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-gray-500">
          No deliveries found.
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDeliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="rounded-xl border bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-lg font-semibold">
                    {delivery.lead.firstName || "Unknown"}{" "}
                    {delivery.lead.lastName || ""}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    Buyer: {delivery.buyer.name}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      delivery.status === "success"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {delivery.status}
                  </div>

                  {delivery.status === "failed" && (
                    <button
                      onClick={() => retryDelivery(delivery.id)}
                      disabled={retryingId === delivery.id}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
                    >
                      {retryingId === delivery.id ? "Retrying..." : "Retry"}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-gray-700 md:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Lead Email
                  </div>
                  <div className="mt-1">{delivery.lead.email || "—"}</div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Lead Phone
                  </div>
                  <div className="mt-1">{delivery.lead.phone || "—"}</div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Status Code
                  </div>
                  <div className="mt-1">{delivery.statusCode ?? "—"}</div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Attempt Number
                  </div>
                  <div className="mt-1">{delivery.attemptNumber}</div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3 md:col-span-2">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Created
                  </div>
                  <div className="mt-1">
                    {new Date(delivery.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium text-blue-600">
                  View response
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-gray-100 p-3 text-xs text-gray-800">
                  {delivery.response || "No response"}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}