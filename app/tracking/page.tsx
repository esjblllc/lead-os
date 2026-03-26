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

export default async function TrackingDashboardPage() {
  const user = await requireCurrentUser();

  const orgWhere = isPlatformAdmin(user)
    ? {}
    : { organizationId: user.organizationId };

  const last24h = getStartDate(1);
  const last7d = getStartDate(7);

  const [clicks24h, clicks7d, recentClicks] = await Promise.all([
    db.clickEvent.findMany({
      where: {
        ...orgWhere,
        createdAt: { gte: last24h },
      },
      orderBy: { createdAt: "desc" },
      include: {
        trackingCampaign: true,
        trackingLink: true,
      },
    }),
    db.clickEvent.findMany({
      where: {
        ...orgWhere,
        createdAt: { gte: last7d },
      },
      orderBy: { createdAt: "desc" },
      include: {
        trackingCampaign: true,
        trackingLink: true,
      },
    }),
    db.clickEvent.findMany({
      where: orgWhere,
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        trackingCampaign: true,
        trackingLink: true,
      },
    }),
  ]);

  const totalClicks24h = clicks24h.length;
  const totalSpend24h = clicks24h.reduce(
    (sum, click) => sum + toNumber(click.cost),
    0
  );
  const avgCpc24h =
    totalClicks24h > 0 ? totalSpend24h / totalClicks24h : 0;

  const sourceMap = new Map<
    string,
    { clicks: number; spend: number }
  >();

  const subIdMap = new Map<
    string,
    { clicks: number; spend: number }
  >();

  for (const click of clicks7d) {
    const sourceKey = click.trafficSource || "unknown";
    const subIdKey = click.subId || "unknown";
    const cost = toNumber(click.cost);

    const existingSource = sourceMap.get(sourceKey) || { clicks: 0, spend: 0 };
    existingSource.clicks += 1;
    existingSource.spend += cost;
    sourceMap.set(sourceKey, existingSource);

    const existingSubId = subIdMap.get(subIdKey) || { clicks: 0, spend: 0 };
    existingSubId.clicks += 1;
    existingSubId.spend += cost;
    subIdMap.set(subIdKey, existingSubId);
  }

  const topSources = Array.from(sourceMap.entries())
    .map(([key, value]) => ({
      key,
      clicks: value.clicks,
      spend: value.spend,
      avgCpc: value.clicks > 0 ? value.spend / value.clicks : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);

  const topSubIds = Array.from(subIdMap.entries())
    .map(([key, value]) => ({
      key,
      clicks: value.clicks,
      spend: value.spend,
      avgCpc: value.clicks > 0 ? value.spend / value.clicks : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Link Tracking Suite
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Tracking Dashboard
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {isPlatformAdmin(user)
                  ? "Platform-wide click tracking, spend visibility, and traffic insights."
                  : `Traffic overview for ${user.organization.name}.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/tracking/campaigns"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Campaigns
              </Link>
              <Link
                href="/tracking/links"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Links
              </Link>
              <Link
                href="/select-suite"
                className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Switch Suite
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Clicks (24h)" value={totalClicks24h} />
          <StatCard label="Spend (24h)" value={currency(totalSpend24h)} />
          <StatCard label="Avg CPC (24h)" value={currency(avgCpc24h)} />
          <StatCard label="Clicks (7d)" value={clicks7d.length} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Top Traffic Sources (Last 7 Days)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Source</th>
                  <th className="px-6 py-3 font-medium">Clicks</th>
                  <th className="px-6 py-3 font-medium">Spend</th>
                  <th className="px-6 py-3 font-medium">Avg CPC</th>
                </tr>
              </thead>
              <tbody>
                {topSources.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                      No source data found yet.
                    </td>
                  </tr>
                ) : (
                  topSources.map((row) => (
                    <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                      <td className="px-6 py-4">{row.clicks}</td>
                      <td className="px-6 py-4">{currency(row.spend)}</td>
                      <td className="px-6 py-4">{currency(row.avgCpc)}</td>
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
              Top Sub IDs (Last 7 Days)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Sub ID</th>
                  <th className="px-6 py-3 font-medium">Clicks</th>
                  <th className="px-6 py-3 font-medium">Spend</th>
                  <th className="px-6 py-3 font-medium">Avg CPC</th>
                </tr>
              </thead>
              <tbody>
                {topSubIds.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                      No sub ID data found yet.
                    </td>
                  </tr>
                ) : (
                  topSubIds.map((row) => (
                    <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                      <td className="px-6 py-4">{row.clicks}</td>
                      <td className="px-6 py-4">{currency(row.spend)}</td>
                      <td className="px-6 py-4">{currency(row.avgCpc)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Clicks</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Campaign</th>
                <th className="px-6 py-3 font-medium">Link</th>
                <th className="px-6 py-3 font-medium">Source</th>
                <th className="px-6 py-3 font-medium">Publisher</th>
                <th className="px-6 py-3 font-medium">Sub ID</th>
                <th className="px-6 py-3 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {recentClicks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    No click activity found yet.
                  </td>
                </tr>
              ) : (
                recentClicks.map((click) => (
                  <tr key={click.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-600">
                      {formatDateTime(click.createdAt)}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {click.trackingCampaign?.name || "—"}
                    </td>
                    <td className="px-6 py-4">
                      {click.trackingLink?.name || click.trackingLink?.slug || "—"}
                    </td>
                    <td className="px-6 py-4">{click.trafficSource || "—"}</td>
                    <td className="px-6 py-4">{click.publisherId || "—"}</td>
                    <td className="px-6 py-4">{click.subId || "—"}</td>
                    <td className="px-6 py-4">{currency(toNumber(click.cost))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
        Next up: tracking campaigns, tracking links, and the redirect engine that logs clicks automatically.
      </div>
    </div>
  );
}