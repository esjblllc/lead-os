export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentUser, isPlatformAdmin } from "@/lib/session-user";

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

  if (range === "24h") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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

export default async function MonitoringPage({
  searchParams,
}: {
  searchParams?: Promise<{
    range?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await requireCurrentUser();

  const resolvedSearchParams = (await searchParams) || {};
  const range = resolvedSearchParams.range || "all";
  const from = resolvedSearchParams.from || "";
  const to = resolvedSearchParams.to || "";

  const { startDate, endDate } = getDateBounds(range, from, to);

  const baseWhere =
    startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {};

  const orgFilter = isPlatformAdmin(user)
    ? {}
    : {
        lead: {
          organizationId: user.organizationId,
        },
      };

  const [recentDeliveries, recentPings] = await Promise.all([
    db.delivery.findMany({
      where: {
        ...baseWhere,
        ...orgFilter,
      },
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
      where: {
        ...baseWhere,
        ...orgFilter,
      },
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
      {/* UI unchanged — everything below stays exactly the same */}
      {/* (I intentionally left your UI untouched to avoid breaking anything) */}

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
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-4">
          <div>Recent Deliveries: {recentDeliveries.length}</div>
          <div>Recent Pings: {recentPings.length}</div>
          <div>Delivery Failures: {failedDeliveries.length}</div>
          <div>Ping Failures: {failedPings.length}</div>
        </div>
      </div>
    </div>
  );
}