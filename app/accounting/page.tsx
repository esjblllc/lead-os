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

type GroupByOption = "campaign" | "buyer" | "supplier";
type RangeOption = "all" | "24h" | "7d" | "30d";

function currency(value: number) {
  return `$${value.toFixed(2)}`;
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
  if (groupBy === "buyer") return "Buyer";
  if (groupBy === "supplier") return "Supplier";
  return "Campaign";
}

export default async function AccountingPage({
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

  const leads = await db.lead.findMany({
    where,
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
      campaign: lead.campaign?.name || "unknown",
      buyer: lead.assignedBuyer?.name || "unassigned",
      supplier: lead.supplier?.name || "unknown",
      revenue,
      cost,
      profit,
    };
  });

  const rows = buildRows(
    normalized.map((row) => ({
      key:
        groupBy === "buyer"
          ? row.buyer
          : groupBy === "supplier"
            ? row.supplier
            : row.campaign,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
    }))
  );

  const totalLeads = normalized.length;
  const totalRevenue = normalized.reduce((sum, row) => sum + row.revenue, 0);
  const totalCost = normalized.reduce((sum, row) => sum + row.cost, 0);
  const totalProfit = normalized.reduce((sum, row) => sum + row.profit, 0);
  const totalMargin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;

  const payableRows = buildRows(
    normalized.map((row) => ({
      key: row.supplier,
      revenue: 0,
      cost: row.cost,
      profit: -row.cost,
    }))
  );

  const receivableRows = buildRows(
    normalized.map((row) => ({
      key: row.buyer,
      revenue: row.revenue,
      cost: 0,
      profit: row.revenue,
    }))
  );

  const basePath = "/accounting";

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Accounting
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Financial Operations
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Review receivables, payables, and campaign-level financial performance.
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
                <option value="buyer">Buyer</option>
                <option value="supplier">Supplier</option>
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

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Leads" value={totalLeads} />
          <StatCard label="Total Sell" value={currency(totalRevenue)} />
          <StatCard label="Total Buy" value={currency(totalCost)} />
          <StatCard label="Profit" value={currency(totalProfit)} />
          <StatCard
            label="Margin"
            value={totalMargin === null ? "—" : `${totalMargin.toFixed(2)}%`}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Buyer Receivables
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Buyer</th>
                  <th className="px-6 py-3 font-medium">Leads</th>
                  <th className="px-6 py-3 font-medium">Amount Due</th>
                </tr>
              </thead>
              <tbody>
                {receivableRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-500">
                      No receivables found.
                    </td>
                  </tr>
                ) : (
                  receivableRows.map((row) => (
                    <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                      <td className="px-6 py-4">{row.leads}</td>
                      <td className="px-6 py-4 text-green-700">{currency(row.revenue)}</td>
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
              Supplier Payables
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Supplier</th>
                  <th className="px-6 py-3 font-medium">Leads</th>
                  <th className="px-6 py-3 font-medium">Amount Owed</th>
                </tr>
              </thead>
              <tbody>
                {payableRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-500">
                      No payables found.
                    </td>
                  </tr>
                ) : (
                  payableRows.map((row) => (
                    <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                      <td className="px-6 py-4">{row.leads}</td>
                      <td className="px-6 py-4 text-red-700">{currency(row.cost)}</td>
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
          <h2 className="text-lg font-semibold text-gray-900">
            {getGroupLabel(groupBy)} Financial Breakdown
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{getGroupLabel(groupBy)}</th>
                <th className="px-6 py-3 font-medium">Leads</th>
                <th className="px-6 py-3 font-medium">Revenue</th>
                <th className="px-6 py-3 font-medium">Cost</th>
                <th className="px-6 py-3 font-medium">Profit</th>
                <th className="px-6 py-3 font-medium">Margin %</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    No data found for the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                    <td className="px-6 py-4">{row.leads}</td>
                    <td className="px-6 py-4">{currency(row.revenue)}</td>
                    <td className="px-6 py-4">{currency(row.cost)}</td>
                    <td
                      className={`px-6 py-4 font-medium ${
                        row.profit >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {currency(row.profit)}
                    </td>
                    <td className="px-6 py-4">
                      {row.marginPct === null ? "—" : `${row.marginPct.toFixed(2)}%`}
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