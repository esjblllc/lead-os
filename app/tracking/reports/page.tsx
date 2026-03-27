import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentUser, isPlatformAdmin } from "@/lib/session-user";

type GroupByOption = "campaign" | "link" | "source" | "publisher" | "subId";
type RangeOption = "all" | "24h" | "7d" | "30d";

type ReportRow = {
  key: string;
  grossClicks: number;
  clicks: number;
  uniqueClicks: number;
  duplicateClicks: number;
  invalidClicks: number;
  totalCv: number;
  cvr: number | null;
  spend: number;
  cpc: number | null;
  cpa: number | null;
  revenue: number;
  rpc: number | null;
  rpa: number | null;
  profit: number;
  marginPct: number | null;
};

type DailyPoint = {
  day: string;
  clicks: number;
  spend: number;
  revenue: number;
  conversions: number;
  profit: number;
};

function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

function metricCurrency(value: number | null) {
  return value === null ? "—" : `$${value.toFixed(2)}`;
}

function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function getPresetStartDate(range: string) {
  const now = new Date();

  if (range === "24h") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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

function getGroupLabel(groupBy: GroupByOption) {
  if (groupBy === "campaign") return "Campaign";
  if (groupBy === "link") return "Partner / Link";
  if (groupBy === "source") return "Traffic Source";
  if (groupBy === "publisher") return "Publisher";
  return "Sub ID";
}

function getGroupKey(groupBy: GroupByOption, click: any) {
  if (groupBy === "campaign") return click.trackingCampaign?.name || "unknown";
  if (groupBy === "link")
    return click.trackingLink?.name || click.trackingLink?.slug || "unknown";
  if (groupBy === "source") return click.trafficSource || "unknown";
  if (groupBy === "publisher") return click.publisherId || "unknown";
  return click.subId || "unknown";
}

function getDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function truncate(text: string, max = 42) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function kpiValueClass(value: number) {
  if (value > 0) return "text-gray-900";
  if (value < 0) return "text-red-700";
  return "text-gray-900";
}

export default async function TrackingReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    range?: RangeOption;
    from?: string;
    to?: string;
    groupBy?: GroupByOption;
    q?: string;
  }>;
}) {
  const user = await requireCurrentUser();

  const params = (await searchParams) || {};
  const range = params.range || "all";
  const from = params.from || "";
  const to = params.to || "";
  const q = (params.q || "").trim().toLowerCase();
  const groupBy: GroupByOption = params.groupBy || "source";

  const { startDate, endDate } = getDateBounds(range, from, to);

  const where =
    startDate || endDate
      ? {
          ...(isPlatformAdmin(user) ? {} : { organizationId: user.organizationId }),
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {
          ...(isPlatformAdmin(user) ? {} : { organizationId: user.organizationId }),
        };

  const [clicks, attributedLeads] = await Promise.all([
    db.clickEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        trackingCampaign: true,
        trackingLink: true,
      },
    }),
    db.lead.findMany({
      where: {
        ...(isPlatformAdmin(user) ? {} : { organizationId: user.organizationId }),
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
        clickId: {
          not: null,
        },
      },
      include: {
        trackingCampaign: true,
        trackingLink: true,
        assignedBuyer: true,
        campaign: true,
      },
    }),
  ]);

  const conversionByClickId = new Map<
    string,
    { count: number; revenue: number }
  >();

  for (const lead of attributedLeads as any[]) {
    if (!lead.clickId) continue;
    const cost = toNumber(lead.cost);
    const profit = toNumber(lead.profit);
    const revenue = cost + profit;

    const existing = conversionByClickId.get(lead.clickId) || {
      count: 0,
      revenue: 0,
    };

    existing.count += 1;
    existing.revenue += revenue;
    conversionByClickId.set(lead.clickId, existing);
  }

  const clickIdsSeen = new Set<string>();
  const rowMap = new Map<string, ReportRow>();
  const dayMap = new Map<string, DailyPoint>();

  let grossClicks = 0;
  let clicksCount = 0;
  let uniqueClicks = 0;
  let duplicateClicks = 0;
  let invalidClicks = 0;
  let totalCv = 0;
  let spend = 0;
  let revenue = 0;

  for (const click of clicks as any[]) {
    grossClicks += 1;

    const key = getGroupKey(groupBy, click);
    const clickCost = toNumber(click.cost);
    const clickId = click.clickId || "";
    const conversion = clickId ? conversionByClickId.get(clickId) : undefined;
    const clickRevenue = conversion?.revenue || 0;
    const clickConversions = conversion?.count || 0;

    const isDuplicate = clickId ? clickIdsSeen.has(clickId) : false;
    if (clickId && !clickIdsSeen.has(clickId)) {
      clickIdsSeen.add(clickId);
      uniqueClicks += 1;
    } else if (isDuplicate) {
      duplicateClicks += 1;
    }

    const isInvalid = !click.trackingLinkId;
    if (isInvalid) {
      invalidClicks += 1;
    } else {
      clicksCount += 1;
    }

    totalCv += clickConversions;
    spend += clickCost;
    revenue += clickRevenue;

    const existing = rowMap.get(key) || {
      key,
      grossClicks: 0,
      clicks: 0,
      uniqueClicks: 0,
      duplicateClicks: 0,
      invalidClicks: 0,
      totalCv: 0,
      cvr: null,
      spend: 0,
      cpc: null,
      cpa: null,
      revenue: 0,
      rpc: null,
      rpa: null,
      profit: 0,
      marginPct: null,
    };

    existing.grossClicks += 1;
    if (isInvalid) {
      existing.invalidClicks += 1;
    } else {
      existing.clicks += 1;
    }
    if (isDuplicate) {
      existing.duplicateClicks += 1;
    } else if (clickId) {
      existing.uniqueClicks += 1;
    }

    existing.totalCv += clickConversions;
    existing.spend += clickCost;
    existing.revenue += clickRevenue;
    existing.profit = existing.revenue - existing.spend;
    existing.cvr =
      existing.clicks > 0 ? (existing.totalCv / existing.clicks) * 100 : null;
    existing.cpc =
      existing.clicks > 0 ? existing.spend / existing.clicks : null;
    existing.cpa =
      existing.totalCv > 0 ? existing.spend / existing.totalCv : null;
    existing.rpc =
      existing.clicks > 0 ? existing.revenue / existing.clicks : null;
    existing.rpa =
      existing.totalCv > 0 ? existing.revenue / existing.totalCv : null;
    existing.marginPct =
      existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : null;

    rowMap.set(key, existing);

    const dayKey = new Intl.DateTimeFormat("en-CA").format(
      new Date(click.createdAt)
    );
    const existingDay = dayMap.get(dayKey) || {
      day: getDayLabel(new Date(click.createdAt)),
      clicks: 0,
      spend: 0,
      revenue: 0,
      conversions: 0,
      profit: 0,
    };

    existingDay.clicks += isInvalid ? 0 : 1;
    existingDay.spend += clickCost;
    existingDay.revenue += clickRevenue;
    existingDay.conversions += clickConversions;
    existingDay.profit = existingDay.revenue - existingDay.spend;

    dayMap.set(dayKey, existingDay);
  }

  let rows = Array.from(rowMap.values());

  if (q) {
    rows = rows.filter((row) => row.key.toLowerCase().includes(q));
  }

  rows.sort((a, b) => b.profit - a.profit);

  const daily = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value);

  const cvr = clicksCount > 0 ? (totalCv / clicksCount) * 100 : null;
  const cpc = clicksCount > 0 ? spend / clicksCount : null;
  const cpa = totalCv > 0 ? spend / totalCv : null;
  const rpc = clicksCount > 0 ? revenue / clicksCount : null;
  const rpa = totalCv > 0 ? revenue / totalCv : null;
  const profit = revenue - spend;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : null;

  const maxGraphValue =
    daily.length > 0
      ? Math.max(
          ...daily.flatMap((d) =>
            [d.clicks, d.conversions, d.spend, d.profit].map((v) => Math.abs(v))
          )
        )
      : 0;

  const exportHref = `/api/reports/tracking/export?range=${encodeURIComponent(
    range
  )}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(
    to
  )}&groupBy=${encodeURIComponent(groupBy)}&q=${encodeURIComponent(q || "")}`;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Link Tracking Suite
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Tracking Reports
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Everflow-style traffic reporting across clicks, spend, conversions, revenue, and profit.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/tracking/reports?groupBy=${groupBy}`}
                className={
                  range === "all" && !from && !to
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                }
              >
                All Time
              </Link>
              <Link
                href={`/tracking/reports?range=24h&groupBy=${groupBy}`}
                className={
                  range === "24h"
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                }
              >
                Last 24h
              </Link>
              <Link
                href={`/tracking/reports?range=7d&groupBy=${groupBy}`}
                className={
                  range === "7d"
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                }
              >
                Last 7d
              </Link>
              <Link
                href={`/tracking/reports?range=30d&groupBy=${groupBy}`}
                className={
                  range === "30d"
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                }
              >
                Last 30d
              </Link>
            </div>
          </div>

          <form method="get" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                Group By
              </label>
              <select
                name="groupBy"
                defaultValue={groupBy}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="campaign">Campaign</option>
                <option value="link">Partner / Link</option>
                <option value="source">Traffic Source</option>
                <option value="publisher">Publisher</option>
                <option value="subId">Sub ID</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search report rows"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Run Report
              </button>

              <Link
                href={exportHref}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Export CSV
              </Link>

              <Link
                href="/tracking/reports"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Clear
              </Link>
            </div>
          </form>
        </div>

        <div className="grid gap-x-10 gap-y-6 px-6 py-5 md:grid-cols-3 xl:grid-cols-7">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              Media Buying Cost
            </div>
            <div className={`mt-2 text-2xl font-bold ${kpiValueClass(-spend)}`}>
              {currency(spend)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              Gross Clicks
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {grossClicks}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              Clicks
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {clicksCount}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              Unique Clicks
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {uniqueClicks}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              Dup. Clicks
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {duplicateClicks}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              Invalid Clicks
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {invalidClicks}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              Total CV
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {totalCv}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              CVR
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {percent(cvr)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              CPC
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {metricCurrency(cpc)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              CPA
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {metricCurrency(cpa)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              RPC
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {metricCurrency(rpc)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              RPA
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {metricCurrency(rpa)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              Revenue
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {currency(revenue)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              Profit
            </div>
            <div className={`mt-2 text-2xl font-bold ${kpiValueClass(profit)}`}>
              {currency(profit)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-gray-400">
              Margin
            </div>
            <div className={`mt-2 text-2xl font-bold ${kpiValueClass(profit)}`}>
              {percent(marginPct)}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Performance Graph</h2>
        </div>

        <div className="p-6">
          {daily.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              No daily traffic data found for the selected filters.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {daily.map((point) => {
                  const clicksHeight =
                    maxGraphValue > 0 ? Math.max((point.clicks / maxGraphValue) * 120, 8) : 8;
                  const spendHeight =
                    maxGraphValue > 0 ? Math.max((point.spend / maxGraphValue) * 120, 8) : 8;
                  const convHeight =
                    maxGraphValue > 0 ? Math.max((point.conversions / maxGraphValue) * 120, 8) : 8;
                  const profitHeight =
                    maxGraphValue > 0 ? Math.max((Math.abs(point.profit) / maxGraphValue) * 120, 8) : 8;

                  return (
                    <div
                      key={point.day}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="mb-4 text-sm font-medium text-gray-700">
                        {point.day}
                      </div>

                      <div className="flex h-36 items-end gap-2">
                        <div className="flex-1">
                          <div
                            className="w-full rounded-t bg-blue-500"
                            style={{ height: `${clicksHeight}px` }}
                            title={`Clicks: ${point.clicks}`}
                          />
                          <div className="mt-2 text-[11px] text-gray-500">Clicks</div>
                        </div>

                        <div className="flex-1">
                          <div
                            className="w-full rounded-t bg-slate-400"
                            style={{ height: `${spendHeight}px` }}
                            title={`Spend: ${currency(point.spend)}`}
                          />
                          <div className="mt-2 text-[11px] text-gray-500">Spend</div>
                        </div>

                        <div className="flex-1">
                          <div
                            className="w-full rounded-t bg-emerald-500"
                            style={{ height: `${convHeight}px` }}
                            title={`CV: ${point.conversions}`}
                          />
                          <div className="mt-2 text-[11px] text-gray-500">CV</div>
                        </div>

                        <div className="flex-1">
                          <div
                            className={`w-full rounded-t ${point.profit >= 0 ? "bg-green-600" : "bg-red-500"}`}
                            style={{ height: `${profitHeight}px` }}
                            title={`Profit: ${currency(point.profit)}`}
                          />
                          <div className="mt-2 text-[11px] text-gray-500">Profit</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-gray-500">
                Daily visualization of clicks, spend, conversions, and profit for the selected period.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Detailed Report</h2>
            <div className="mt-1 text-sm text-gray-500">
              Grouped by {getGroupLabel(groupBy).toLowerCase()}.
            </div>
          </div>

          <Link
            href="/tracking/reports/variance"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Open Tracking Variance
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1900px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{getGroupLabel(groupBy)}</th>
                <th className="px-6 py-3 font-medium">Gross Clicks</th>
                <th className="px-6 py-3 font-medium">Clicks</th>
                <th className="px-6 py-3 font-medium">Uniq. Clicks</th>
                <th className="px-6 py-3 font-medium">Dup. Clicks</th>
                <th className="px-6 py-3 font-medium">Invalid Clicks</th>
                <th className="px-6 py-3 font-medium">Total CV</th>
                <th className="px-6 py-3 font-medium">CVR</th>
                <th className="px-6 py-3 font-medium">CPC</th>
                <th className="px-6 py-3 font-medium">CPA</th>
                <th className="px-6 py-3 font-medium">RPC</th>
                <th className="px-6 py-3 font-medium">RPA</th>
                <th className="px-6 py-3 font-medium">Revenue</th>
                <th className="px-6 py-3 font-medium">Payout</th>
                <th className="px-6 py-3 font-medium">Profit</th>
                <th className="px-6 py-3 font-medium">Margin</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={16}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No tracking data found for the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900" title={row.key}>
                      {truncate(row.key, 52)}
                    </td>
                    <td className="px-6 py-4">{row.grossClicks}</td>
                    <td className="px-6 py-4">{row.clicks}</td>
                    <td className="px-6 py-4">{row.uniqueClicks}</td>
                    <td className="px-6 py-4">{row.duplicateClicks}</td>
                    <td className="px-6 py-4">{row.invalidClicks}</td>
                    <td className="px-6 py-4">{row.totalCv}</td>
                    <td className="px-6 py-4">{percent(row.cvr)}</td>
                    <td className="px-6 py-4">{metricCurrency(row.cpc)}</td>
                    <td className="px-6 py-4">{metricCurrency(row.cpa)}</td>
                    <td className="px-6 py-4">{metricCurrency(row.rpc)}</td>
                    <td className="px-6 py-4">{metricCurrency(row.rpa)}</td>
                    <td className="px-6 py-4">{currency(row.revenue)}</td>
                    <td className="px-6 py-4">{currency(row.spend)}</td>
                    <td
                      className={`px-6 py-4 font-medium ${
                        row.profit > 0
                          ? "text-green-700"
                          : row.profit < 0
                            ? "text-red-700"
                            : "text-gray-900"
                      }`}
                    >
                      {currency(row.profit)}
                    </td>
                    <td className="px-6 py-4">{percent(row.marginPct)}</td>
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