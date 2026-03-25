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

function getEasternDayStartUtc() {
  const now = new Date();

  const easternDateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const localMidnight = new Date(`${easternDateString}T00:00:00.000`);
  const easternMidnightString = localMidnight.toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  const easternMidnightAsLocal = new Date(easternMidnightString);
  const diffMs = localMidnight.getTime() - easternMidnightAsLocal.getTime();

  return new Date(localMidnight.getTime() + diffMs);
}

function getLast7DaysUtc() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

function formatEasternDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function buildGroupedRows(
  items: {
    key: string;
    revenue: number;
    cost: number;
    profit: number;
    leads?: number;
  }[]
) {
  const map = new Map<
    string,
    {
      key: string;
      leads: number;
      revenue: number;
      cost: number;
      profit: number;
      marginPct: number | null;
    }
  >();

  for (const item of items) {
    const existing = map.get(item.key) || {
      key: item.key,
      leads: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      marginPct: null,
    };

    existing.leads += item.leads ?? 1;
    existing.revenue += item.revenue;
    existing.cost += item.cost;
    existing.profit += item.profit;
    existing.marginPct =
      existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : null;

    map.set(item.key, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.profit - a.profit);
}

function StatCard({
  label,
  value,
  subValue,
  tone = "default",
}: {
  label: string;
  value: string | number;
  subValue?: string;
  tone?: "default" | "blue" | "green" | "orange" | "indigo";
}) {
  const wrapperClass =
    tone === "blue"
      ? "from-white to-blue-50"
      : tone === "green"
        ? "from-white to-green-50"
        : tone === "orange"
          ? "from-white to-orange-50"
          : tone === "indigo"
            ? "from-white to-indigo-50"
            : "from-white to-gray-50";

  const valueClass =
    tone === "blue"
      ? "text-blue-700"
      : tone === "green"
        ? "text-green-700"
        : tone === "orange"
          ? "text-orange-700"
          : tone === "indigo"
            ? "text-indigo-700"
            : "text-gray-900";

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-gradient-to-br ${wrapperClass} p-5 shadow-sm`}
    >
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className={`mt-3 text-3xl font-bold tracking-tight ${valueClass}`}>
        {value}
      </div>
      {subValue ? <div className="mt-2 text-sm text-gray-500">{subValue}</div> : null}
    </div>
  );
}

function SimpleTable({
  title,
  rows,
  firstColumnLabel,
  valueLabel,
}: {
  title: string;
  rows: {
    key: string;
    leads: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number | null;
  }[];
  firstColumnLabel: string;
  valueLabel: string;
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
                <th className="px-6 py-3 font-medium">Leads</th>
                <th className="px-6 py-3 font-medium">{valueLabel}</th>
                <th className="px-6 py-3 font-medium">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row) => (
                <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                  <td className="px-6 py-4">{row.leads}</td>
                  <td className="px-6 py-4 text-green-700">{currency(row.profit)}</td>
                  <td className="px-6 py-4">
                    {row.marginPct === null ? "—" : `${row.marginPct.toFixed(2)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function HomePage() {
  const user = await requireCurrentUser();

  const todayStart = getEasternDayStartUtc();
  const last7DaysStart = getLast7DaysUtc();

  const orgWhere = isPlatformAdmin(user)
    ? {}
    : {
        organizationId: user.organizationId,
      };

  const [todayLeads, recentLeads, recentDeliveries, recentPings] = await Promise.all([
    db.lead.findMany({
      where: {
        ...orgWhere,
        createdAt: { gte: todayStart },
      },
      include: {
        campaign: true,
        assignedBuyer: true,
        supplier: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.lead.findMany({
      where: {
        ...orgWhere,
        createdAt: { gte: last7DaysStart },
      },
      include: {
        campaign: true,
        assignedBuyer: true,
        supplier: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.delivery.findMany({
      where: isPlatformAdmin(user)
        ? { createdAt: { gte: last7DaysStart } }
        : {
            createdAt: { gte: last7DaysStart },
            lead: {
              organizationId: user.organizationId,
            },
          },
      include: {
        buyer: true,
        lead: {
          include: {
            campaign: true,
            supplier: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.pingResult.findMany({
      where: isPlatformAdmin(user)
        ? { createdAt: { gte: last7DaysStart } }
        : {
            createdAt: { gte: last7DaysStart },
            lead: {
              organizationId: user.organizationId,
            },
          },
      include: {
        buyer: true,
        lead: {
          include: {
            campaign: true,
            supplier: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const todayAssigned = todayLeads.filter((lead) => lead.routingStatus === "assigned").length;
  const todayPending = todayLeads.filter((lead) => lead.routingStatus === "pending").length;

  const todayRevenue = todayLeads.reduce((sum, lead) => {
    const cost = toNumber(lead.cost);
    const profit = toNumber(lead.profit);
    return sum + (cost + profit);
  }, 0);

  const todayCost = todayLeads.reduce((sum, lead) => sum + toNumber(lead.cost), 0);
  const todayProfit = todayLeads.reduce((sum, lead) => sum + toNumber(lead.profit), 0);
  const todayMargin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : null;

  const normalizedRecentLeads = recentLeads.map((lead) => {
    const cost = toNumber(lead.cost);
    const profit = toNumber(lead.profit);
    const revenue = cost + profit;

    return {
      campaign: lead.campaign?.name || "unknown",
      buyer: lead.assignedBuyer?.name || "unassigned",
      revenue,
      cost,
      profit,
    };
  });

  const campaignRows = buildGroupedRows(
    normalizedRecentLeads.map((row) => ({
      key: row.campaign,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
    }))
  );

  const buyerRows = buildGroupedRows(
    normalizedRecentLeads.map((row) => ({
      key: row.buyer,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
    }))
  );

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
                  ? "Platform-wide lead flow, routing health, and financial performance."
                  : `Organization snapshot for ${user.organization.name}.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/leads"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                View Leads
              </Link>
              <Link
                href="/performance"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                View Reports
              </Link>
              <Link
                href="/accounting"
                className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white"
              >
                View Accounting
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Today's Leads"
            value={todayLeads.length}
            subValue={`${todayAssigned} assigned / ${todayPending} pending`}
          />
          <StatCard
            label="Today's Revenue"
            value={currency(todayRevenue)}
            tone="blue"
          />
          <StatCard
            label="Today's Cost"
            value={currency(todayCost)}
            tone="orange"
          />
          <StatCard
            label="Today's Profit"
            value={currency(todayProfit)}
            tone="green"
          />
          <StatCard
            label="Today's Margin"
            value={todayMargin === null ? "—" : `${todayMargin.toFixed(2)}%`}
            tone="indigo"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SimpleTable
          title="Top Campaigns (Last 7 Days)"
          rows={campaignRows}
          firstColumnLabel="Campaign"
          valueLabel="Profit"
        />

        <SimpleTable
          title="Top Buyers (Last 7 Days)"
          rows={buyerRows}
          firstColumnLabel="Buyer"
          valueLabel="Profit"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-1">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
          </div>

          {recentLeads.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500">No recent leads.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {lead.firstName || "Unknown"} {lead.lastName || ""}
                      </div>
                      <div className="text-sm text-gray-500">
                        {lead.campaign?.name || "—"}
                      </div>
                    </div>

                    <div className="text-right text-xs text-gray-500">
                      {formatEasternDateTime(lead.createdAt)}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-gray-600">
                    {lead.assignedBuyer?.name || "Unassigned"} · {lead.source || "unknown"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-1">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Deliveries</h2>
          </div>

          {recentDeliveries.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500">No recent deliveries.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentDeliveries.map((delivery) => (
                <div key={delivery.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {delivery.buyer?.name || "Unknown Buyer"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {delivery.lead.campaign?.name || "—"}
                      </div>
                    </div>

                    <div className="text-right text-xs text-gray-500">
                      {formatEasternDateTime(delivery.createdAt)}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-gray-600">
                    Status: {delivery.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-1">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Pings</h2>
          </div>

          {recentPings.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500">No recent pings.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentPings.map((ping) => (
                <div key={ping.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {ping.buyer?.name || "Unknown Buyer"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {ping.lead.campaign?.name || "—"}
                      </div>
                    </div>

                    <div className="text-right text-xs text-gray-500">
                      {formatEasternDateTime(ping.createdAt)}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-gray-600">
                    Status: {ping.status}
                    {ping.bid !== null && typeof ping.bid !== "undefined"
                      ? ` · Bid $${Number(ping.bid).toFixed(2)}`
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}