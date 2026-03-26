import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentUser, isPlatformAdmin } from "@/lib/session-user";

type GroupByOption = "campaign" | "link" | "source" | "publisher" | "subId";
type RangeOption = "all" | "24h" | "7d" | "30d";

type ReportRow = {
  key: string;
  clicks: number;
  spend: number;
  avgCpc: number | null;
};

function currency(value: number) {
  return `$${value.toFixed(4)}`;
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

function buildRows(
  items: {
    key: string;
    spend: number;
  }[]
): ReportRow[] {
  const map = new Map<string, ReportRow>();

  for (const item of items) {
    const existing = map.get(item.key) || {
      key: item.key,
      clicks: 0,
      spend: 0,
      avgCpc: null,
    };

    existing.clicks += 1;
    existing.spend += item.spend;
    existing.avgCpc =
      existing.clicks > 0 ? existing.spend / existing.clicks : null;

    map.set(item.key, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.clicks - a.clicks);
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
        {value}
      </div>
    </div>
  );
}

function getGroupLabel(groupBy: GroupByOption) {
  if (groupBy === "campaign") return "Campaign";
  if (groupBy === "link") return "Tracking Link";
  if (groupBy === "source") return "Traffic Source";
  if (groupBy === "publisher") return "Publisher";
  return "Sub ID";
}

export default async function TrackingReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    range?: RangeOption;
    from?: string;
    to?: string;
    groupBy?: GroupByOption;
  }>;
}) {
  const user = await requireCurrentUser();

  const params = (await searchParams) || {};
  const range = params.range || "all";
  const from = params.from || "";
  const to = params.to || "";
  const groupBy: GroupByOption = params.groupBy || "campaign";

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

  const clicks = await db.clickEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      trackingCampaign: true,
      trackingLink: true,
    },
  });

  const normalized = clicks.map((click: any) => ({
    campaign: click.trackingCampaign?.name || "unknown",
    link: click.trackingLink?.name || click.trackingLink?.slug || "unknown",
    source: click.trafficSource || "unknown",
    publisher: click.publisherId || "unknown",
    subId: click.subId || "unknown",
    spend: toNumber(click.cost),
  }));

  const rows = buildRows(
    normalized.map((row) => ({
      key:
        groupBy === "campaign"
          ? row.campaign
          : groupBy === "link"
            ? row.link
            : groupBy === "source"
              ? row.source
              : groupBy === "publisher"
                ? row.publisher
                : row.subId,
      spend: row.spend,
    }))
  );

  const totalClicks = normalized.length;
  const totalSpend = normalized.reduce((sum, row) => sum + row.spend, 0);
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : null;
  const activeRows = rows.filter((row) => row.clicks > 0).length;

  const basePath = "/tracking/reports";

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
                Analyze clicks and spend by campaign, tracking link, source, publisher, or sub ID.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`${basePath}?groupBy=${groupBy}`}
                className={
                  range === "all" && !from && !to
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                }
              >
                All Time
              </Link>
              <Link
                href={`${basePath}?range=24h&groupBy=${groupBy}`}
                className={
                  range === "24h"
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                }
              >
                Last 24h
              </Link>
              <Link
                href={`${basePath}?range=7d&groupBy=${groupBy}`}
                className={
                  range === "7d"
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                }
              >
                Last 7d
              </Link>
              <Link
                href={`${basePath}?range=30d&groupBy=${groupBy}`}
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

          <form method="get" className="mt-5 grid gap-4 md:grid-cols-5">
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
                <option value="link">Tracking Link</option>
                <option value="source">Traffic Source</option>
                <option value="publisher">Publisher</option>
                <option value="subId">Sub ID</option>
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
                href={basePath}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Clear
              </Link>
            </div>
          </form>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Clicks" value={totalClicks} />
          <StatCard label="Total Spend" value={currency(totalSpend)} />
          <StatCard
            label="Average CPC"
            value={avgCpc === null ? "—" : currency(avgCpc)}
          />
          <StatCard
            label={`${getGroupLabel(groupBy)} Rows`}
            value={activeRows}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {getGroupLabel(groupBy)} Breakdown
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{getGroupLabel(groupBy)}</th>
                <th className="px-6 py-3 font-medium">Clicks</th>
                <th className="px-6 py-3 font-medium">Spend</th>
                <th className="px-6 py-3 font-medium">Avg CPC</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No tracking data found for the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {row.key}
                    </td>
                    <td className="px-6 py-4">{row.clicks}</td>
                    <td className="px-6 py-4">{currency(row.spend)}</td>
                    <td className="px-6 py-4">
                      {row.avgCpc === null ? "—" : currency(row.avgCpc)}
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