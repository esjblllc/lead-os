export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { db } from "@/lib/db";

type CountRow = {
  key: string;
  count: number;
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

function buildCountRows(items: string[]): CountRow[] {
  const map = new Map<string, number>();

  for (const item of items) {
    map.set(item, (map.get(item) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
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

function SummaryTable({
  title,
  rows,
  firstColumnLabel,
}: {
  title: string;
  rows: CountRow[];
  firstColumnLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-10 text-sm text-gray-500">No data available.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{firstColumnLabel}</th>
                <th className="px-6 py-3 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                  <td className="px-6 py-4">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function MonitoringPage({
  searchParams,
}: {
  searchParams?: Promise<{
    range?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const range = resolvedSearchParams.range || "all";
  const from = resolvedSearchParams.from || "";
  const to = resolvedSearchParams.to || "";

  const { startDate, endDate } = getDateBounds(range, from, to);

  const dateWhere =
    startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : undefined;

  const [recentDeliveries, recentPings] = await Promise.all([
    db.delivery.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      take: 50,
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
    db.pingResult.findMany({
      where: dateWhere,
      orderBy: { createdAt: "desc" },
      take: 50,
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

  const failedDeliveries = recentDeliveries.filter(
    (d: any) => d.status !== "success"
  );

  const failedPings = recentPings.filter((p: any) =>
    ["error", "timeout", "invalid_response", "failed"].includes(p.status)
  );

  const deliveryFailureCampaigns = buildCountRows(
    failedDeliveries.map((d: any) => d.lead.campaign?.name || "Unknown Campaign")
  );

  const deliveryFailureBuyers = buildCountRows(
    failedDeliveries.map((d: any) => d.buyer?.name || "Unknown Buyer")
  );

  const pingFailureCampaigns = buildCountRows(
    failedPings.map((p: any) => p.lead.campaign?.name || "Unknown Campaign")
  );

  const pingFailureBuyers = buildCountRows(
    failedPings.map((p: any) => p.buyer?.name || "Unknown Buyer")
  );

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
                Monitoring
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Routing Health
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Monitor delivery failures, ping failures, and recent routing activity.
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
                        ? "/monitoring"
                        : `/monitoring?range=${option.key}`
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

          <form
            action="/monitoring"
            method="get"
            className="mt-5 grid gap-4 md:grid-cols-4"
          >
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

            <div className="flex items-end gap-3 md:col-span-2">
              <button
                type="submit"
                className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Apply Custom Range
              </button>

              <Link
                href="/monitoring"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Clear
              </Link>
            </div>
          </form>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Recent Deliveries" value={recentDeliveries.length} />
          <StatCard label="Recent Pings" value={recentPings.length} tone="blue" />
          <StatCard
            label="Delivery Failures"
            value={failedDeliveries.length}
            tone="red"
          />
          <StatCard label="Ping Failures" value={failedPings.length} tone="indigo" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SummaryTable
          title="Delivery Failures by Campaign"
          rows={deliveryFailureCampaigns}
          firstColumnLabel="Campaign"
        />

        <SummaryTable
          title="Delivery Failures by Buyer"
          rows={deliveryFailureBuyers}
          firstColumnLabel="Buyer"
        />

        <SummaryTable
          title="Ping Failures by Campaign"
          rows={pingFailureCampaigns}
          firstColumnLabel="Campaign"
        />

        <SummaryTable
          title="Ping Failures by Buyer"
          rows={pingFailureBuyers}
          firstColumnLabel="Buyer"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Deliveries</h2>
          </div>

          {recentDeliveries.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500">
              No delivery activity found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Lead</th>
                    <th className="px-6 py-3 font-medium">Campaign</th>
                    <th className="px-6 py-3 font-medium">Buyer</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeliveries.map((delivery: any) => (
                    <tr
                      key={delivery.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-gray-500">
                        {formatEasternDateTime(delivery.createdAt)}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {`${delivery.lead.firstName || "Unknown"} ${delivery.lead.lastName || ""}`.trim()}
                      </td>
                      <td className="px-6 py-4">
                        {delivery.lead.campaign?.name || "—"}
                      </td>
                      <td className="px-6 py-4">{delivery.buyer?.name || "—"}</td>
                      <td className="px-6 py-4">{delivery.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Pings</h2>
          </div>

          {recentPings.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500">
              No ping activity found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Lead</th>
                    <th className="px-6 py-3 font-medium">Campaign</th>
                    <th className="px-6 py-3 font-medium">Buyer</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPings.map((ping: any) => (
                    <tr
                      key={ping.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-gray-500">
                        {formatEasternDateTime(ping.createdAt)}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {`${ping.lead.firstName || "Unknown"} ${ping.lead.lastName || ""}`.trim()}
                      </td>
                      <td className="px-6 py-4">
                        {ping.lead.campaign?.name || "—"}
                      </td>
                      <td className="px-6 py-4">{ping.buyer?.name || "—"}</td>
                      <td className="px-6 py-4">{ping.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}