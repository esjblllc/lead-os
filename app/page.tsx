import Link from "next/link";
import { db } from "@/lib/db";

function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

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

function getDateBounds(range: string, from?: string, to?: string) {
  if (from || to) {
    return {
      startDate: from ? new Date(`${from}T00:00:00`) : null,
      endDate: to ? new Date(`${to}T23:59:59.999`) : null,
    };
  }

  return {
    startDate: getPresetStartDate(range),
    endDate: null,
  };
}

function toNumber(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") {
    return 0;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

type CampaignSummary = {
  name: string;
  leads: number;
  assigned: number;
  failed: number;
  profit: number;
};

export default async function DashboardPage({
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

  const leadWhere =
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

  const pingWhere =
    startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : undefined;

  const [leads, deliveries, pings] = await Promise.all([
    db.lead.findMany({
      where: leadWhere,
      include: {
        campaign: true,
        assignedBuyer: true,
        supplier: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.delivery.findMany({
      where: deliveryWhere,
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
      where: pingWhere,
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

  const totalLeads = leads.length;
  const assignedLeads = leads.filter((lead: any) => lead.routingStatus === "assigned").length;
  const pendingLeads = leads.filter((lead: any) => lead.routingStatus === "pending").length;

  const totalRevenue = leads.reduce(
    (sum: number, lead: any) => sum + toNumber(lead.assignedBuyer?.pricePerLead),
    0
  );
  const totalCost = leads.reduce((sum: number, lead: any) => sum + toNumber(lead.cost), 0);
  const totalProfit = leads.reduce((sum: number, lead: any) => sum + toNumber(lead.profit), 0);
  const totalMargin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;

  const campaignMap = new Map<string, CampaignSummary>();

  for (const lead of leads) {
    const key = lead.campaign?.name || "Unknown Campaign";
    const existing = campaignMap.get(key) || {
      name: key,
      leads: 0,
      assigned: 0,
      failed: 0,
      profit: 0,
    };

    existing.leads += 1;
    if (lead.routingStatus === "assigned") {
      existing.assigned += 1;
    }
    if (lead.routingStatus !== "assigned") {
      existing.failed += 1;
    }
    existing.profit += toNumber(lead.profit);

    campaignMap.set(key, existing);
  }

  const topCampaigns = Array.from(campaignMap.values())
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  const recentFailures = [
    ...deliveries
      .filter((d: any) => d.status !== "success")
      .map((d: any) => ({
        id: d.id,
        time: d.createdAt,
        type: "delivery",
        campaign: d.lead.campaign?.name || "—",
        buyer: d.buyer?.name || "—",
        detail: d.response || `HTTP ${d.statusCode ?? "—"}`,
        status: d.status,
      })),
    ...pings
      .filter((p: any) =>
        ["error", "timeout", "invalid_response"].includes(p.status)
      )
      .map((p: any) => ({
        id: p.id,
        time: p.createdAt,
        type: "ping",
        campaign: p.lead.campaign?.name || "—",
        buyer: p.buyer?.name || "—",
        detail: p.error || p.response || "—",
        status: p.status,
      })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 8);

  const rangeOptions = [
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
                Dashboard
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Lead Operations Overview
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Overview of lead volume, routing outcomes, top campaigns, recent failures, and financial performance.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => {
                const isActive = !usingCustomRange && range === option.key;

                return (
                  <Link
                    key={option.key}
                    href={option.key === "all" ? "/" : `/?range=${option.key}`}
                    className={
                      isActive
                        ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm"
                        : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    }
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <form action="/" method="get" className="mt-5 grid gap-4 md:grid-cols-4">
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
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Apply Custom Range
              </button>

              <Link
                href="/"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Clear
              </Link>
            </div>
          </form>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5">
            <div className="text-sm font-medium text-gray-500">Total Leads</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
              {totalLeads}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-green-50 p-5">
            <div className="text-sm font-medium text-gray-500">Assigned</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-green-700">
              {assignedLeads}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-yellow-50 p-5">
            <div className="text-sm font-medium text-gray-500">Pending</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-yellow-700">
              {pendingLeads}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-blue-50 p-5">
            <div className="text-sm font-medium text-gray-500">Profit / Margin</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-blue-700">
              {currency(totalProfit)}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {totalMargin === null ? "—" : `${totalMargin.toFixed(2)}%`}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">
              Top 5 Campaigns
            </h2>
          </div>

          {topCampaigns.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500">No campaign data yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Campaign</th>
                    <th className="px-6 py-3 font-medium">Leads</th>
                    <th className="px-6 py-3 font-medium">Assigned</th>
                    <th className="px-6 py-3 font-medium">Failed</th>
                    <th className="px-6 py-3 font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.map((campaign) => (
                    <tr key={campaign.name} className="border-t border-gray-100">
                      <td className="px-6 py-4 font-medium text-gray-900">{campaign.name}</td>
                      <td className="px-6 py-4">{campaign.leads}</td>
                      <td className="px-6 py-4 text-green-700">{campaign.assigned}</td>
                      <td className="px-6 py-4 text-red-700">{campaign.failed}</td>
                      <td className="px-6 py-4 font-medium text-blue-700">
                        {currency(campaign.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">
              Financial Snapshot
            </h2>
          </div>

          <div className="space-y-4 p-6">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-500">Total Sell</div>
              <div className="mt-2 text-2xl font-bold text-green-700">
                {currency(totalRevenue)}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-500">Total Buy</div>
              <div className="mt-2 text-2xl font-bold text-red-700">
                {currency(totalCost)}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-500">Net Profit</div>
              <div className="mt-2 text-2xl font-bold text-blue-700">
                {currency(totalProfit)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">
            Recent Failures
          </h2>
        </div>

        {recentFailures.length === 0 ? (
          <div className="px-6 py-10 text-sm text-gray-500">
            No recent failures in the selected range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Campaign</th>
                  <th className="px-6 py-3 font-medium">Buyer</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {recentFailures.map((event) => (
                  <tr key={`${event.type}-${event.id}`} className="border-t border-gray-100">
                    <td className="px-6 py-4 text-gray-500">
                      {event.time.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          event.type === "ping"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-indigo-100 text-indigo-700"
                        }`}
                      >
                        {event.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">{event.campaign}</td>
                    <td className="px-6 py-4">{event.buyer}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                        {event.status}
                      </span>
                    </td>
                    <td className="max-w-[500px] px-6 py-4 whitespace-pre-wrap break-words text-gray-700">
                      {event.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}