import { db } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import {
  getRequestSessionUser,
  isPlatformAdmin,
} from "@/lib/request-session-user";

type GroupByOption = "campaign" | "buyer" | "supplier" | "source" | "subId";

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultPeriodA() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 6);

  return {
    from: formatDateInput(from),
    to: formatDateInput(today),
  };
}

function shiftDateString(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}

function daysBetweenInclusive(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

function buildComparisonDefaults(
  periodAFrom?: string,
  periodATo?: string,
  periodBFrom?: string,
  periodBTo?: string
) {
  const defaultA = getDefaultPeriodA();
  const finalAFrom = periodAFrom || defaultA.from;
  const finalATo = periodATo || defaultA.to;

  if (periodBFrom && periodBTo) {
    return { periodAFrom: finalAFrom, periodATo: finalATo, periodBFrom, periodBTo };
  }

  const span = daysBetweenInclusive(finalAFrom, finalATo);
  const derivedBTo = shiftDateString(finalAFrom, -1);
  const derivedBFrom = shiftDateString(derivedBTo, -(span - 1));

  return {
    periodAFrom: finalAFrom,
    periodATo: finalATo,
    periodBFrom: derivedBFrom,
    periodBTo: derivedBTo,
  };
}

function getDateBounds(from?: string, to?: string) {
  return {
    startDate: from ? new Date(`${from}T00:00:00`) : null,
    endDate: to ? new Date(`${to}T23:59:59.999`) : null,
  };
}

function getGroupValue(groupBy: GroupByOption, lead: any) {
  if (groupBy === "campaign") return lead.campaign?.name || "unknown";
  if (groupBy === "buyer") return lead.assignedBuyer?.name || "unassigned";
  if (groupBy === "supplier") return lead.supplier?.name || "unknown";
  if (groupBy === "source") return lead.source || "unknown";
  return lead.subId || "unknown";
}

function pctChange(current: number, prior: number) {
  if (prior === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - prior) / Math.abs(prior)) * 100;
}

function marginPct(revenue: number, profit: number) {
  return revenue > 0 ? (profit / revenue) * 100 : null;
}

export async function GET(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const groupBy = (url.searchParams.get("groupBy") || "subId") as GroupByOption;

    const { periodAFrom, periodATo, periodBFrom, periodBTo } = buildComparisonDefaults(
      url.searchParams.get("periodAFrom") || undefined,
      url.searchParams.get("periodATo") || undefined,
      url.searchParams.get("periodBFrom") || undefined,
      url.searchParams.get("periodBTo") || undefined
    );

    const periodABounds = getDateBounds(periodAFrom, periodATo);
    const periodBBounds = getDateBounds(periodBFrom, periodBTo);

    const orgWhere = isPlatformAdmin(sessionUser)
      ? {}
      : { organizationId: sessionUser.organizationId };

    const [periodALeads, periodBLeads] = await Promise.all([
      db.lead.findMany({
        where: {
          ...orgWhere,
          routingStatus: "assigned",
          createdAt: {
            ...(periodABounds.startDate ? { gte: periodABounds.startDate } : {}),
            ...(periodABounds.endDate ? { lte: periodABounds.endDate } : {}),
          },
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
          routingStatus: "assigned",
          createdAt: {
            ...(periodBBounds.startDate ? { gte: periodBBounds.startDate } : {}),
            ...(periodBBounds.endDate ? { lte: periodBBounds.endDate } : {}),
          },
        },
        include: {
          campaign: true,
          assignedBuyer: true,
          supplier: true,
        },
      }),
    ]);

    const map = new Map<
      string,
      {
        key: string;
        periodALeads: number;
        periodARevenue: number;
        periodACost: number;
        periodAProfit: number;
        periodBLeads: number;
        periodBRevenue: number;
        periodBCost: number;
        periodBProfit: number;
      }
    >();

    for (const lead of periodALeads as any[]) {
      const key = getGroupValue(groupBy, lead);
      const cost = toNumber(lead.cost);
      const profit = toNumber(lead.profit);
      const revenue = cost + profit;

      const existing = map.get(key) || {
        key,
        periodALeads: 0,
        periodARevenue: 0,
        periodACost: 0,
        periodAProfit: 0,
        periodBLeads: 0,
        periodBRevenue: 0,
        periodBCost: 0,
        periodBProfit: 0,
      };

      existing.periodALeads += 1;
      existing.periodARevenue += revenue;
      existing.periodACost += cost;
      existing.periodAProfit += profit;
      map.set(key, existing);
    }

    for (const lead of periodBLeads as any[]) {
      const key = getGroupValue(groupBy, lead);
      const cost = toNumber(lead.cost);
      const profit = toNumber(lead.profit);
      const revenue = cost + profit;

      const existing = map.get(key) || {
        key,
        periodALeads: 0,
        periodARevenue: 0,
        periodACost: 0,
        periodAProfit: 0,
        periodBLeads: 0,
        periodBRevenue: 0,
        periodBCost: 0,
        periodBProfit: 0,
      };

      existing.periodBLeads += 1;
      existing.periodBRevenue += revenue;
      existing.periodBCost += cost;
      existing.periodBProfit += profit;
      map.set(key, existing);
    }

    const rows = Array.from(map.values())
      .map((row) => {
        const periodAMarginPct = marginPct(row.periodARevenue, row.periodAProfit);
        const periodBMarginPct = marginPct(row.periodBRevenue, row.periodBProfit);

        return [
          row.key,
          row.periodALeads,
          row.periodBLeads,
          row.periodALeads - row.periodBLeads,
          pctChange(row.periodALeads, row.periodBLeads),
          row.periodARevenue.toFixed(2),
          row.periodBRevenue.toFixed(2),
          (row.periodARevenue - row.periodBRevenue).toFixed(2),
          pctChange(row.periodARevenue, row.periodBRevenue),
          row.periodACost.toFixed(2),
          row.periodBCost.toFixed(2),
          (row.periodACost - row.periodBCost).toFixed(2),
          pctChange(row.periodACost, row.periodBCost),
          row.periodAProfit.toFixed(2),
          row.periodBProfit.toFixed(2),
          (row.periodAProfit - row.periodBProfit).toFixed(2),
          pctChange(row.periodAProfit, row.periodBProfit),
          periodAMarginPct === null ? "" : periodAMarginPct.toFixed(2),
          periodBMarginPct === null ? "" : periodBMarginPct.toFixed(2),
          periodAMarginPct === null || periodBMarginPct === null
            ? ""
            : (periodAMarginPct - periodBMarginPct).toFixed(2),
        ];
      })
      .sort((a: any, b: any) => Math.abs(Number(b[15])) - Math.abs(Number(a[15])));

    const csv = toCsv(
      [
        "Group",
        "LeadsA",
        "LeadsB",
        "DeltaLeads",
        "DeltaLeadsPct",
        "RevenueA",
        "RevenueB",
        "DeltaRevenue",
        "DeltaRevenuePct",
        "CostA",
        "CostB",
        "DeltaCost",
        "DeltaCostPct",
        "ProfitA",
        "ProfitB",
        "DeltaProfit",
        "DeltaProfitPct",
        "MarginA",
        "MarginB",
        "DeltaMargin",
      ],
      rows
    );

    return csvResponse("lead-variance-report.csv", csv);
  } catch (error) {
    console.error("Performance variance export error:", error);
    return new Response("Failed to export variance report", { status: 500 });
  }
}