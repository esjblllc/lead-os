import { db } from "@/lib/db";
import { isPlatformAdmin, getCurrentUser } from "@/lib/session-user";

type GroupByOption = "campaign" | "buyer" | "supplier" | "source" | "subId";

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

function getGroupValue(groupBy: GroupByOption, lead: any) {
  if (groupBy === "campaign") return lead.campaign?.name || "unknown";
  if (groupBy === "buyer") return lead.assignedBuyer?.name || "unassigned";
  if (groupBy === "supplier") return lead.supplier?.name || "unknown";
  if (groupBy === "source") return lead.source || "unknown";
  return lead.subId || "unknown";
}

function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const str = String(value);

  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function toCsv(headers: string[], rows: (string | number)[][]) {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "all";
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const groupBy = (url.searchParams.get("groupBy") || "campaign") as GroupByOption;

    const { startDate, endDate } = getDateBounds(range, from, to);

    const where =
      startDate || endDate
        ? {
            ...(isPlatformAdmin(user) ? {} : { organizationId: user.organizationId }),
            routingStatus: "assigned" as const,
            createdAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {
            ...(isPlatformAdmin(user) ? {} : { organizationId: user.organizationId }),
            routingStatus: "assigned" as const,
          };

    const leads = await db.lead.findMany({
      where,
      include: {
        campaign: true,
        assignedBuyer: true,
        supplier: true,
      },
      orderBy: { createdAt: "desc" },
    });

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

    for (const lead of leads as any[]) {
      const key = getGroupValue(groupBy, lead);
      const cost = toNumber(lead.cost);
      const profit = toNumber(lead.profit);
      const revenue = cost + profit;

      const existing = map.get(key) || {
        key,
        leads: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        marginPct: null,
      };

      existing.leads += 1;
      existing.revenue += revenue;
      existing.cost += cost;
      existing.profit += profit;
      existing.marginPct =
        existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : null;

      map.set(key, existing);
    }

    const rows = Array.from(map.values()).sort((a, b) => b.profit - a.profit);

    const csv = toCsv(
      ["Group", "Leads", "Revenue", "Cost", "Profit", "MarginPct"],
      rows.map((row) => [
        row.key,
        row.leads,
        row.revenue.toFixed(2),
        row.cost.toFixed(2),
        row.profit.toFixed(2),
        row.marginPct === null ? "" : row.marginPct.toFixed(2),
      ])
    );

    return csvResponse("lead-performance-report.csv", csv);
  } catch (error) {
    console.error("Performance export error:", error);
    return new Response("Failed to export report", { status: 500 });
  }
}