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

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" | ");
}

function statusTone(value: number, highIsGood = true) {
  if ((highIsGood && value > 0) || (!highIsGood && value === 0)) {
    return "text-green-700";
  }

  if (value > 0) {
    return "text-amber-700";
  }

  return "text-gray-900";
}

function StatCard({
  label,
  value,
  subValue,
  tone = "text-gray-900",
}: {
  label: string;
  value: string | number;
  subValue?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className={`mt-3 text-3xl font-bold tracking-tight ${tone}`}>
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

  const [
    leads24h,
    leads7d,
    pendingLeadCount,
    activeCampaignCount,
    pausedBuyerCount,
    recentLeads,
    recentDeliveries,
    recentPings,
    activeCappedBuyers,
  ] = await Promise.all([
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
    db.lead.count({
      where: {
        ...orgWhere,
        routingStatus: "pending",
      },
    }),
    db.campaign.count({
      where: {
        ...orgWhere,
        status: "active",
      },
    }),
    db.buyer.count({
      where: {
        ...orgWhere,
        status: "paused",
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
    db.buyer.findMany({
      where: {
        ...orgWhere,
        status: "active",
        dailyCap: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        dailyCap: true,
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

  const groupedCampaigns = new Map<
    string,
    { leads: number; assigned: number; pending: number; profit: number }
  >();

  const buyerLeadCounts24h = new Map<string, number>();

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

    const campaignKey = lead.campaign?.name || "Unknown Campaign";
    const campaignRow = groupedCampaigns.get(campaignKey) || {
      leads: 0,
      assigned: 0,
      pending: 0,
      profit: 0,
    };
    campaignRow.leads += 1;
    campaignRow.assigned += lead.routingStatus === "assigned" ? 1 : 0;
    campaignRow.pending += lead.routingStatus === "pending" ? 1 : 0;
    campaignRow.profit += profit;
    groupedCampaigns.set(campaignKey, campaignRow);
  }

  for (const lead of leads24h as any[]) {
    if (!lead.assignedBuyerId) continue;
    buyerLeadCounts24h.set(
      lead.assignedBuyerId,
      (buyerLeadCounts24h.get(lead.assignedBuyerId) || 0) + 1
    );
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

  const topCampaigns = Array.from(groupedCampaigns.entries())
    .map(([key, value]) => ({
      key,
      ...value,
    }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);

  const failedDeliveries = recentDeliveries.filter((delivery: any) => {
    const status = String(delivery.status || "").toLowerCase();
    return !["success", "delivered", "accepted"].includes(status);
  });

  const failedPings = recentPings.filter((ping: any) => {
    const status = String(ping.status || "").toLowerCase();
    return ["error", "timeout", "invalid_response", "failed"].includes(status);
  });

  const capRiskBuyers = activeCappedBuyers
    .map((buyer) => {
      const used = buyerLeadCounts24h.get(buyer.id) || 0;
      const cap = buyer.dailyCap || 0;
      const utilizationPct = cap > 0 ? (used / cap) * 100 : 0;

      return {
        id: buyer.id,
        name: buyer.name,
        used,
        cap,
        utilizationPct,
      };
    })
    .filter((buyer) => buyer.cap > 0 && buyer.utilizationPct >= 80)
    .sort((a, b) => b.utilizationPct - a.utilizationPct)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Dashboard
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Operations Overview
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {isPlatformAdmin(user)
                  ? "Platform-wide lead flow, routing health, buyer pressure, and commercial performance."
                  : `Operations snapshot for ${user.organization.name}.`}
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
                href="/monitoring"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Monitoring
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

        <div className="rounded-b-2xl bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-blue-200 bg-white/90 p-4">
              <div className="text-sm font-medium text-gray-500">Lead Flow</div>
              <div className="mt-2 text-lg font-semibold text-gray-900">
                {leads24h.length} leads in the last 24h
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {pendingLeadCount} currently pending across the workspace
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white/90 p-4">
              <div className="text-sm font-medium text-gray-500">Commercial</div>
              <div className="mt-2 text-lg font-semibold text-gray-900">
                {currency(profit24h)} profit in the last 24h
              </div>
              <div className="mt-1 text-sm text-gray-600">
                Revenue {currency(revenue24h)} | Cost {currency(cost24h)}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-white/90 p-4">
              <div className="text-sm font-medium text-gray-500">Buyer Pressure</div>
              <div className="mt-2 text-lg font-semibold text-gray-900">
                {capRiskBuyers.length} buyers near cap
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {pausedBuyerCount} paused buyers need review
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-white/90 p-4">
              <div className="text-sm font-medium text-gray-500">Routing Health</div>
              <div className="mt-2 text-lg font-semibold text-gray-900">
                {failedDeliveries.length + failedPings.length} recent failures
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {activeCampaignCount} active campaigns currently live
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Leads (24h)" value={leads24h.length} />
        <StatCard
          label="Pending Leads"
          value={pendingLeadCount}
          subValue="Leads waiting for routing or handoff"
          tone={statusTone(pendingLeadCount, false)}
        />
        <StatCard label="Active Campaigns" value={activeCampaignCount} />
        <StatCard
          label="Paused Buyers"
          value={pausedBuyerCount}
          subValue="Buyers not currently taking traffic"
          tone={statusTone(pausedBuyerCount, false)}
        />
        <StatCard label="Profit (24h)" value={currency(profit24h)} tone="text-emerald-700" />
        <StatCard
          label="Margin (24h)"
          value={margin24h === null ? "-" : `${margin24h.toFixed(2)}%`}
          subValue="Based on visible revenue and profit"
          tone={margin24h !== null && margin24h >= 0 ? "text-blue-700" : "text-gray-900"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Top Campaigns (Last 7 Days)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Campaign</th>
                  <th className="px-6 py-3 font-medium">Leads</th>
                  <th className="px-6 py-3 font-medium">Assigned</th>
                  <th className="px-6 py-3 font-medium">Pending</th>
                  <th className="px-6 py-3 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {topCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                      No campaign activity found.
                    </td>
                  </tr>
                ) : (
                  topCampaigns.map((row) => (
                    <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                      <td className="px-6 py-4">{row.leads}</td>
                      <td className="px-6 py-4 text-green-700">{row.assigned}</td>
                      <td className="px-6 py-4 text-amber-700">{row.pending}</td>
                      <td className="px-6 py-4 text-emerald-700">{currency(row.profit)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Buyer Cap Risk (24h)
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {capRiskBuyers.length === 0 ? (
              <div className="px-6 py-10 text-sm text-gray-500">
                No buyers are near daily cap right now.
              </div>
            ) : (
              capRiskBuyers.map((buyer) => (
                <div key={buyer.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">{buyer.name}</div>
                      <div className="text-sm text-gray-500">
                        {buyer.used} of {buyer.cap} leads used
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-amber-700">
                      {buyer.utilizationPct.toFixed(0)}%
                    </div>
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
                        {row.marginPct === null ? "-" : `${row.marginPct.toFixed(2)}%`}
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
                        {joinParts([lead.campaign?.name || "-", lead.subId || "unknown"])}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {formatDateTime(lead.createdAt)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    {joinParts([lead.assignedBuyer?.name || "Unassigned", lead.routingStatus])}
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
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Delivery Issues
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {failedDeliveries.length === 0 ? (
              <div className="px-6 py-10 text-sm text-gray-500">
                No recent delivery issues.
              </div>
            ) : (
              failedDeliveries.map((delivery: any) => (
                <div key={delivery.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {delivery.buyer?.name || "Unknown Buyer"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {delivery.lead?.campaign?.name || "-"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {formatDateTime(delivery.createdAt)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-amber-700">
                    {joinParts([
                      `Status ${delivery.status}`,
                      delivery.statusCode ? `Code ${delivery.statusCode}` : null,
                    ])}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Ping Issues
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {failedPings.length === 0 ? (
              <div className="px-6 py-10 text-sm text-gray-500">
                No recent ping issues.
              </div>
            ) : (
              failedPings.map((ping: any) => (
                <div key={ping.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {ping.buyer?.name || "Unknown Buyer"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {ping.lead?.campaign?.name || "-"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {formatDateTime(ping.createdAt)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-rose-700">
                    {joinParts([
                      `Status ${ping.status}`,
                      ping.bid !== null && typeof ping.bid !== "undefined"
                        ? `Bid $${Number(ping.bid).toFixed(2)}`
                        : null,
                    ])}
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
