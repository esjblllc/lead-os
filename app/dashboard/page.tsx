import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentUser, isPlatformAdmin } from "@/lib/session-user";

function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function getStartDate(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function StatCard({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string | number;
  subValue?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
        {value}
      </div>
      {subValue ? <div className="mt-2 text-sm text-gray-500">{subValue}</div> : null}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireCurrentUser();

  const orgWhere = isPlatformAdmin(user)
    ? {}
    : { organizationId: user.organizationId };

  const last24h = getStartDate(1);
  const last7d = getStartDate(7);

  const [leads24h, leads7d, recentLeads, recentDeliveries, recentPings] =
    await Promise.all([
      db.lead.findMany({
        where: {
          ...orgWhere,
          createdAt: { gte: last24h },
        },
        include: {
          campaign: true,
          assignedBuyer: true,
          supplier: true,
        },
      }),
      db.lead.findMany({
        where: {
          ...orgWhere,
          createdAt: { gte: last7d },
        },
        include: {
          campaign: true,
          assignedBuyer: true,
          supplier: true,
        },
      }),
      db.lead.findMany({
        where: orgWhere,
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          campaign: true,
          assignedBuyer: true,
          supplier: true,
        },
      }),
      db.delivery.findMany({
        where: isPlatformAdmin(user)
          ? {}
          : {
              lead: {
                organizationId: user.organizationId,
              },
            },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          buyer: true,
          lead: {
            include: {
              campaign: true,
            },
          },
        },
      }),
      db.pingResult.findMany({
        where: isPlatformAdmin(user)
          ? {}
          : {
              lead: {
                organizationId: user.organizationId,
              },
            },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          buyer: true,
          lead: {
            include: {
              campaign: true,
            },
          },
        },
      }),
    ]);

  const revenue24h = leads24h.reduce((sum, lead: any) => {
    const cost = toNumber(lead.cost);
    const profit = toNumber(lead.profit);
    return sum + cost + profit;
  }, 0);

  const cost24h = leads24h.reduce((sum, lead: any) => sum + toNumber(lead.cost), 0);
  const profit24h = leads24h.reduce((sum, lead: any) => sum + toNumber(lead.profit), 0);
  const margin24h = revenue24h > 0 ? (profit24h / revenue24h) * 100 : null;

  const groupedSubIds = new Map<
    string,
    { leads: number; profit: number; revenue: number }
  >();

  for (const lead of leads7d as any[]) {
    const key = lead.subId || "unknown";
    const cost = toNumber(lead.cost);
    const profit = toNumber(lead.profit);
    const revenue = cost + profit;

    const existing = groupedSubIds.get(key) || { leads: 0, profit: 0, revenue: 0 };
    existing.leads += 1;
    existing.profit += profit;
    existing.revenue += revenue;
    groupedSubIds.set(key, existing);
  }

  const topSubIds = Array.from(groupedSubIds.entries())
    .map(([key, value]) => ({
      key,
      leads: value.leads,
      profit: value.profit,
      marginPct: value.revenue > 0 ? (value.profit / value.revenue) * 100 : null,
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Dashboard
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Overview
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {isPlatformAdmin(user)
                  ? "Platform-wide lead flow, routing activity, and financial performance."
                  : `Organization snapshot for ${user.organization.name}.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/performance"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Reports
              </Link>
              <Link
                href="/accounting"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Accounting
              </Link>
              <Link
                href="/logs"
                className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Logs
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Leads (24h)" value={leads24h.length} />
          <StatCard label="Revenue (24h)" value={currency(revenue24h)} />
          <StatCard label="Cost (24h)" value={currency(cost24h)} />
          <StatCard label="Profit (24h)" value={currency(profit24h)} />
          <StatCard
            label="Margin (24h)"
            value={margin24h === null ? "—" : `${margin24h.toFixed(2)}%`}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Top Sub IDs (Last 7 Days)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Sub ID</th>
                  <th className="px-6 py-3 font-medium">Leads</th>
                  <th className="px-6 py-3 font-medium">Profit</th>
                  <th className="px-6 py-3 font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {topSubIds.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                      No sub ID data found.
                    </td>
                  </tr>
                ) : (
                  topSubIds.map((row) => (
                    <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                      <td className="px-6 py-4">{row.leads}</td>
                      <td className="px-6 py-4 text-green-700">{currency(row.profit)}</td>
                      <td className="px-6 py-4">
                        {row.marginPct === null ? "—" : `${row.marginPct.toFixed(2)}%`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {recentLeads.length === 0 ? (
              <div className="px-6 py-10 text-sm text-gray-500">No recent leads.</div>
            ) : (
              recentLeads.map((lead: any) => (
                <div key={lead.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {(lead.firstName || "Unknown") + " " + (lead.lastName || "")}
                      </div>
                      <div className="text-sm text-gray-500">
                        {lead.campaign?.name || "—"} · {lead.subId || "unknown"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {formatDateTime(lead.createdAt)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    {lead.assignedBuyer?.name || "Unassigned"} · {lead.routingStatus}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Deliveries</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {recentDeliveries.length === 0 ? (
              <div className="px-6 py-10 text-sm text-gray-500">No recent deliveries.</div>
            ) : (
              recentDeliveries.map((delivery: any) => (
                <div key={delivery.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {delivery.buyer?.name || "Unknown Buyer"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {delivery.lead?.campaign?.name || "—"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {formatDateTime(delivery.createdAt)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Status: {delivery.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Pings</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {recentPings.length === 0 ? (
              <div className="px-6 py-10 text-sm text-gray-500">No recent pings.</div>
            ) : (
              recentPings.map((ping: any) => (
                <div key={ping.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {ping.buyer?.name || "Unknown Buyer"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {ping.lead?.campaign?.name || "—"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {formatDateTime(ping.createdAt)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Status: {ping.status}
                    {ping.bid !== null && typeof ping.bid !== "undefined"
                      ? ` · Bid $${Number(ping.bid).toFixed(2)}`
                      : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}