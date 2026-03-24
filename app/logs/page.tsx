export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { db } from "@/lib/db";

type LogEvent = {
  id: string;
  timestamp: Date;
  type: "ping" | "delivery";
  leadId: string;
  leadName: string;
  campaignName: string;
  buyerName: string;
  supplierName: string;
  status: string;
  bidOrCode: string;
  detail: string;
};

type RangeOption = {
  key: string;
  label: string;
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

function getEasternDayRange(dateString: string, endOfDay = false) {
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const local = new Date(`${dateString}${suffix}`);

  const easternString = local.toLocaleString("en-US", {
    timeZone: "America/New_York",
  });

  const easternDate = new Date(easternString);
  const diffMs = local.getTime() - easternDate.getTime();

  return new Date(local.getTime() + diffMs);
}

function getDateBounds(range: string, from?: string, to?: string) {
  if (from || to) {
    return {
      startDate: from ? getEasternDayRange(from, false) : null,
      endDate: to ? getEasternDayRange(to, true) : null,
    };
  }

  return {
    startDate: getPresetStartDate(range),
    endDate: null,
  };
}

function formatEasternDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function truncateId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "blue" | "indigo" | "red";
}) {
  const wrapperClass =
    tone === "blue"
      ? "from-white to-blue-50"
      : tone === "indigo"
        ? "from-white to-indigo-50"
        : tone === "red"
          ? "from-white to-red-50"
          : "from-white to-gray-50";

  const valueClass =
    tone === "blue"
      ? "text-blue-700"
      : tone === "indigo"
        ? "text-indigo-700"
        : tone === "red"
          ? "text-red-700"
          : "text-gray-900";

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-gradient-to-br ${wrapperClass} p-5 shadow-sm`}
    >
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className={`mt-3 text-3xl font-bold tracking-tight ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function EventTypeBadge({ type }: { type: "ping" | "delivery" }) {
  const className =
    type === "ping"
      ? "bg-blue-100 text-blue-800"
      : "bg-indigo-100 text-indigo-800";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className = ["success", "accepted"].includes(status)
    ? "bg-green-100 text-green-800"
    : ["failed", "error", "timeout", "invalid_response"].includes(status)
      ? "bg-red-100 text-red-800"
      : "bg-gray-200 text-gray-800";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    range?: string;
    from?: string;
    to?: string;
    type?: string;
    status?: string;
  }>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const range = resolvedSearchParams.range || "all";
  const from = resolvedSearchParams.from || "";
  const to = resolvedSearchParams.to || "";
  const typeFilter = resolvedSearchParams.type || "all";
  const statusFilter = resolvedSearchParams.status || "all";

  const { startDate, endDate } = getDateBounds(range, from, to);

  const pingWhere =
    startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : undefined;

  const deliveryWhere =
    startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : undefined;

  const [pings, deliveries] = await Promise.all([
    db.pingResult.findMany({
      where: pingWhere,
      orderBy: { createdAt: "desc" },
      include: {
        buyer: true,
        lead: {
          include: {
            campaign: true,
            supplier: true,
          },
        },
      },
    }),
    db.delivery.findMany({
      where: deliveryWhere,
      orderBy: { createdAt: "desc" },
      include: {
        buyer: true,
        lead: {
          include: {
            campaign: true,
            supplier: true,
          },
        },
      },
    }),
  ]);

  const pingEvents: LogEvent[] = pings.map((ping: any) => ({
    id: ping.id,
    timestamp: ping.createdAt,
    type: "ping",
    leadId: ping.leadId,
    leadName: `${ping.lead.firstName || "Unknown"} ${ping.lead.lastName || ""}`.trim(),
    campaignName: ping.lead.campaign?.name || "—",
    buyerName: ping.buyer?.name || "—",
    supplierName: ping.lead.supplier?.name || "—",
    status: ping.status,
    bidOrCode:
      ping.bid !== null && typeof ping.bid !== "undefined"
        ? `$${Number(ping.bid).toFixed(2)}`
        : "—",
    detail:
      ping.error || ping.response || (ping.won ? "Winning ping" : "No details"),
  }));

  const deliveryEvents: LogEvent[] = deliveries.map((delivery: any) => ({
    id: delivery.id,
    timestamp: delivery.createdAt,
    type: "delivery",
    leadId: delivery.leadId,
    leadName: `${delivery.lead.firstName || "Unknown"} ${delivery.lead.lastName || ""}`.trim(),
    campaignName: delivery.lead.campaign?.name || "—",
    buyerName: delivery.buyer?.name || "—",
    supplierName: delivery.lead.supplier?.name || "—",
    status: delivery.status,
    bidOrCode:
      delivery.statusCode !== null && typeof delivery.statusCode !== "undefined"
        ? String(delivery.statusCode)
        : "—",
    detail:
      delivery.response ||
      `Attempt ${delivery.attemptNumber}${
        delivery.statusCode ? ` • HTTP ${delivery.statusCode}` : ""
      }`,
  }));

  let events = [...pingEvents, ...deliveryEvents].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  if (typeFilter !== "all") {
    events = events.filter((event) => event.type === typeFilter);
  }

  if (statusFilter !== "all") {
    events = events.filter((event) => event.status === statusFilter);
  }

  const totalEvents = events.length;
  const pingCount = events.filter((event) => event.type === "ping").length;
  const deliveryCount = events.filter((event) => event.type === "delivery").length;
  const failureCount = events.filter((event) =>
    ["failed", "error", "timeout", "invalid_response"].includes(event.status)
  ).length;

  const rangeOptions: RangeOption[] = [
    { key: "all", label: "All Time" },
    { key: "24h", label: "Last 24h" },
    { key: "7d", label: "Last 7d" },
    { key: "30d", label: "Last 30d" },
  ];

  const usingCustomRange = Boolean(from || to);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Logs
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Event Timeline
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Review ping and delivery events across leads, buyers, suppliers,
                and campaigns.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => {
                const isActive = !usingCustomRange && range === option.key;

                return (
                  <Link
                    key={option.key}
                    href={
                      option.key === "all"
                        ? "/logs"
                        : `/logs?range=${option.key}`
                    }
                    className={
                      isActive
                        ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                        : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    }
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <form action="/logs" method="get" className="mt-5 grid gap-4 md:grid-cols-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                From
              </label>
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                To
              </label>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Event Type
              </label>
              <select
                name="type"
                defaultValue={typeFilter}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="ping">Ping</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                name="status"
                defaultValue={statusFilter}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="accepted">accepted</option>
                <option value="rejected">rejected</option>
                <option value="timeout">timeout</option>
                <option value="error">error</option>
                <option value="invalid_response">invalid_response</option>
                <option value="success">success</option>
                <option value="failed">failed</option>
              </select>
            </div>

            <div className="flex items-end gap-3 md:col-span-2">
              <button
                type="submit"
                className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Apply Filters
              </button>

              <Link
                href="/logs"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Clear
              </Link>
            </div>
          </form>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-4">
          <StatCard label="Total Events" value={totalEvents} />
          <StatCard label="Ping Events" value={pingCount} tone="blue" />
          <StatCard label="Delivery Events" value={deliveryCount} tone="indigo" />
          <StatCard label="Failures / Errors" value={failureCount} tone="red" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Buyer</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Bid / Code</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>

            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No log events found.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr
                    key={`${event.type}-${event.id}`}
                    className="border-t border-gray-100 align-top hover:bg-gray-50"
                  >
                    <td className="px-4 py-4 text-gray-500">
                      {formatEasternDateTime(event.timestamp)}
                    </td>

                    <td className="px-4 py-4">
                      <EventTypeBadge type={event.type} />
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{event.leadName}</div>
                      <div className="text-xs text-gray-500">
                        {truncateId(event.leadId)}
                      </div>
                    </td>

                    <td className="px-4 py-4">{event.campaignName}</td>
                    <td className="px-4 py-4">{event.buyerName}</td>
                    <td className="px-4 py-4">{event.supplierName}</td>

                    <td className="px-4 py-4">
                      <StatusBadge status={event.status} />
                    </td>

                    <td className="px-4 py-4">{event.bidOrCode}</td>

                    <td className="max-w-[500px] px-4 py-4 whitespace-pre-wrap break-words text-gray-700">
                      {event.detail}
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