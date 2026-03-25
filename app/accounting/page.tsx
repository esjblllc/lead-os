import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentUser, isPlatformAdmin } from "@/lib/session-user";

type FinancialRow = {
  key: string;
  leads: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
};

function currency(value: number) {
  return `$${value.toFixed(2)}`;
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

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function buildGroupedRows(
  items: { key: string; revenue: number; cost: number; profit: number }[]
): FinancialRow[] {
  const map = new Map<string, FinancialRow>();

  for (const item of items) {
    const existing = map.get(item.key) || {
      key: item.key,
      leads: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      marginPct: null,
    };

    existing.leads += 1;
    existing.revenue += item.revenue;
    existing.cost += item.cost;
    existing.profit += item.profit;
    existing.marginPct =
      existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : null;

    map.set(item.key, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.profit - a.profit);
}

export default async function AccountingPage({ searchParams }: any) {
  const user = await requireCurrentUser();

  const params = (await searchParams) || {};
  const range = params.range || "all";
  const from = params.from || "";
  const to = params.to || "";

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

  const leads = await db.lead.findMany({
    where: isPlatformAdmin(user)
      ? baseWhere
      : {
          ...baseWhere,
          organizationId: user.organizationId,
        },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: true,
      assignedBuyer: true,
      supplier: true,
    },
  });

  const normalized = leads.map((lead: any) => {
    const revenue = toNumber(lead.assignedBuyer?.pricePerLead);
    const cost = toNumber(lead.cost);
    const profit = toNumber(lead.profit);

    return {
      buyer: lead.assignedBuyer?.name || "unassigned",
      supplier: lead.supplier?.name || "unknown",
      campaign: lead.campaign?.name || "unknown",
      revenue,
      cost,
      profit,
    };
  });

  const buyerRows = buildGroupedRows(
    normalized.map((r: any) => ({
      key: r.buyer,
      revenue: r.revenue,
      cost: 0,
      profit: r.revenue,
    }))
  );

  const supplierRows = buildGroupedRows(
    normalized.map((r: any) => ({
      key: r.supplier,
      revenue: 0,
      cost: r.cost,
      profit: -r.cost,
    }))
  );

  const campaignRows = buildGroupedRows(
    normalized.map((r: any) => ({
      key: r.campaign,
      revenue: r.revenue,
      cost: r.cost,
      profit: r.profit,
    }))
  );

  const totalRevenue = normalized.reduce((s: number, r: any) => s + r.revenue, 0);
  const totalCost = normalized.reduce((s: number, r: any) => s + r.cost, 0);
  const totalProfit = normalized.reduce((s: number, r: any) => s + r.profit, 0);

  const totalMargin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <h1 className="text-2xl font-bold">Accounting</h1>

        <div className="mt-4 grid grid-cols-4 gap-4">
          <div>Revenue: {currency(totalRevenue)}</div>
          <div>Cost: {currency(totalCost)}</div>
          <div>Profit: {currency(totalProfit)}</div>
          <div>
            Margin: {totalMargin ? totalMargin.toFixed(2) + "%" : "—"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-4">Campaign Financials</h2>

        {campaignRows.map((row: any) => (
          <div key={row.key} className="flex justify-between border-b py-2">
            <div>{row.key}</div>
            <div>{currency(row.profit)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}