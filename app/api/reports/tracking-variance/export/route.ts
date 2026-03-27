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

function pctChange(current: number, prior: number) {
  if (prior === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - prior) / Math.abs(prior)) * 100;
}

function avgCpc(clicks: number, spend: number) {
  return clicks > 0 ? spend / clicks : null;
}

function getGroupValue(groupBy: GroupByOption, click: any) {
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

    const [periodAClicks, periodBClicks] = await Promise.all([
      db.clickEvent.findMany({
        where: {
          ...orgWhere,
          createdAt: {
            ...(periodABounds.startDate ? { gte: periodABounds.startDate } : {}),
            ...(periodABounds.endDate ? { lte: periodABounds.endDate } : {}),
          },
        },
        include: {
          trackingCampaign: true,
          trackingLink: true,
        },
      }),
      db.clickEvent.findMany({
        where: {
          ...orgWhere,
          createdAt: {
            ...(periodBBounds.startDate ? { gte: periodBBounds.startDate } : {}),
            ...(periodBBounds.endDate ? { lte: periodBBounds.endDate } : {}),
          },
        },
        include: {
          trackingCampaign: true,
          trackingLink: true,
        },
      }),
    ]);

    const map = new Map<
      string,
      {
        key: string;
        periodAClicks: number;
        periodASpend: number;
        periodBClicks: number;
        periodBSpend: number;
      }
    >();

    for (const click of periodAClicks as any[]) {
      const key = getGroupValue(groupBy, click);
      const existing = map.get(key) || {
        key,
        periodAClicks: 0,
        periodASpend: 0,
        periodBClicks: 0,
        periodBSpend: 0,
      };

      existing.periodAClicks += 1;
      existing.periodASpend += toNumber(click.cost);
      map.set(key, existing);
    }

    for (const click of periodBClicks as any[]) {
      const key = getGroupValue(groupBy, click);
      const existing = map.get(key) || {
        key,
        periodAClicks: 0,
        periodASpend: 0,
        periodBClicks: 0,
        periodBSpend: 0,
      };

      existing.periodBClicks += 1;
      existing.periodBSpend += toNumber(click.cost);
      map.set(key, existing);
    }

    const rows = Array.from(map.values())
      .map((row) => {
        const periodAAvgCpc = avgCpc(row.periodAClicks, row.periodASpend);
        const periodBAvgCpc = avgCpc(row.periodBClicks, row.periodBSpend);

        return [
          row.key,
          row.periodAClicks,
          row.periodBClicks,
          row.periodAClicks - row.periodBClicks,
          pctChange(row.periodAClicks, row.periodBClicks),
          row.periodASpend.toFixed(4),
          row.periodBSpend.toFixed(4),
          (row.periodASpend - row.periodBSpend).toFixed(4),
          pctChange(row.periodASpend, row.periodBSpend),
          periodAAvgCpc === null ? "" : periodAAvgCpc.toFixed(4),
          periodBAvgCpc === null ? "" : periodBAvgCpc.toFixed(4),
          periodAAvgCpc === null || periodBAvgCpc === null
            ? ""
            : (periodAAvgCpc - periodBAvgCpc).toFixed(4),
          periodAAvgCpc === null || periodBAvgCpc === null
            ? ""
            : pctChange(periodAAvgCpc, periodBAvgCpc),
        ];
      })
      .sort((a: any, b: any) => Math.abs(Number(b[7])) - Math.abs(Number(a[7])));

    const csv = toCsv(
      [
        "Group",
        "ClicksA",
        "ClicksB",
        "DeltaClicks",
        "DeltaClicksPct",
        "SpendA",
        "SpendB",
        "DeltaSpend",
        "DeltaSpendPct",
        "AvgCPCA",
        "AvgCPCB",
        "DeltaAvgCPC",
        "DeltaAvgCPCPct",
      ],
      rows
    );

    return csvResponse("tracking-variance-report.csv", csv);
  } catch (error) {
    console.error("Tracking variance export error:", error);
    return new Response("Failed to export tracking variance report", { status: 500 });
  }
}