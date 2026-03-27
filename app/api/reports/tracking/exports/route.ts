import { db } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import {
  getRequestSessionUser,
  isPlatformAdmin,
} from "@/lib/request-session-user";

type GroupByOption = "campaign" | "link" | "source" | "publisher" | "subId";

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

function getGroupKey(groupBy: GroupByOption, click: any) {
  if (groupBy === "campaign") return click.trackingCampaign?.name || "unknown";
  if (groupBy === "link")
    return click.trackingLink?.name || click.trackingLink?.slug || "unknown";
  if (groupBy === "source") return click.trafficSource || "unknown";
  if (groupBy === "publisher") return click.publisherId || "unknown";
  return click.subId || "unknown";
}

export async function GET(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "all";
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const groupBy = (url.searchParams.get("groupBy") || "source") as GroupByOption;

    const { startDate, endDate } = getDateBounds(range, from, to);

    const where =
      startDate || endDate
        ? {
            ...(isPlatformAdmin(sessionUser)
              ? {}
              : { organizationId: sessionUser.organizationId }),
            createdAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {
            ...(isPlatformAdmin(sessionUser)
              ? {}
              : { organizationId: sessionUser.organizationId }),
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
          ...(isPlatformAdmin(sessionUser)
            ? {}
            : { organizationId: sessionUser.organizationId }),
          ...(startDate || endDate
            ? {
                createdAt: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
          clickId: { not: null },
        },
      }),
    ]);

    const conversionByClickId = new Map<string, { count: number; revenue: number }>();

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
    const rowMap = new Map<string, any>();

    for (const click of clicks as any[]) {
      const key = getGroupKey(groupBy, click);
      const clickId = click.clickId || "";
      const clickCost = toNumber(click.cost);
      const conversion = clickId ? conversionByClickId.get(clickId) : undefined;
      const clickRevenue = conversion?.revenue || 0;
      const clickConversions = conversion?.count || 0;

      const isDuplicate = clickId ? clickIdsSeen.has(clickId) : false;
      if (clickId && !clickIdsSeen.has(clickId)) {
        clickIdsSeen.add(clickId);
      }

      const isInvalid = !click.trackingLinkId;

      const existing = rowMap.get(key) || {
        key,
        grossClicks: 0,
        clicks: 0,
        uniqueClicks: 0,
        duplicateClicks: 0,
        invalidClicks: 0,
        totalCv: 0,
        spend: 0,
        revenue: 0,
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

      rowMap.set(key, existing);
    }

    let rows = Array.from(rowMap.values()).map((row) => {
      const profit = row.revenue - row.spend;
      const cvr = row.clicks > 0 ? (row.totalCv / row.clicks) * 100 : null;
      const cpc = row.clicks > 0 ? row.spend / row.clicks : null;
      const cpa = row.totalCv > 0 ? row.spend / row.totalCv : null;
      const rpc = row.clicks > 0 ? row.revenue / row.clicks : null;
      const rpa = row.totalCv > 0 ? row.revenue / row.totalCv : null;
      const marginPct = row.revenue > 0 ? (profit / row.revenue) * 100 : null;

      return {
        ...row,
        profit,
        cvr,
        cpc,
        cpa,
        rpc,
        rpa,
        marginPct,
      };
    });

    if (q) {
      rows = rows.filter((row) => row.key.toLowerCase().includes(q));
    }

    rows.sort((a, b) => b.profit - a.profit);

    const csv = toCsv(
      [
        "Group",
        "GrossClicks",
        "Clicks",
        "UniqueClicks",
        "DuplicateClicks",
        "InvalidClicks",
        "TotalCV",
        "CVR",
        "CPC",
        "CPA",
        "RPC",
        "RPA",
        "Revenue",
        "Payout",
        "Profit",
        "MarginPct",
      ],
      rows.map((row) => [
        row.key,
        row.grossClicks,
        row.clicks,
        row.uniqueClicks,
        row.duplicateClicks,
        row.invalidClicks,
        row.totalCv,
        row.cvr === null ? "" : row.cvr.toFixed(2),
        row.cpc === null ? "" : row.cpc.toFixed(2),
        row.cpa === null ? "" : row.cpa.toFixed(2),
        row.rpc === null ? "" : row.rpc.toFixed(2),
        row.rpa === null ? "" : row.rpa.toFixed(2),
        row.revenue.toFixed(2),
        row.spend.toFixed(2),
        row.profit.toFixed(2),
        row.marginPct === null ? "" : row.marginPct.toFixed(2),
      ])
    );

    return csvResponse("tracking-report.csv", csv);
  } catch (error) {
    console.error("Tracking export error:", error);
    return new Response("Failed to export tracking report", { status: 500 });
  }
}