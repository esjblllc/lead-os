import Link from "next/link";
import { db } from "@/lib/db";

type FinancialRow = {
  key: string;
  leads: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
};

type RangeOption = {
  key: string;
  label: string;
};

function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

function getPresetStartDate(range: string) {
  const now = new Date();

  if (range === "24h") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  if (range === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (range === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

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
  if (value === null || typeof value === "undefined" || value === "") {
    return 0;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function buildGroupedRows(
  items: {
    key: string;
    revenue: number;
    cost: number;
    profit: number;
  }[]
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

function getTopRow(rows: FinancialRow[]) {
  return rows.length > 0 ? rows[0] : null;
}

function StatCard({
  label,
  value,
  subValue,
  tone = "default",
}: {
  label: string;
  value: string | number;
  subValue?: string;
  tone?: "default" | "green" | "red" | "blue";
}) {
  const wrapperClass =
    tone === "green"
      ? "from-white to-green-50"
      : tone === "red"
      ? "from-white to-red-50"
      : tone === "blue"
      ? "from-white to-blue-50"
      : "from-white to-gray-50";

  const valueClass =
    tone === "green"
      ? "text-green-700"
      : tone === "red"
      ? "text-red-700"
      : tone === "blue"
      ? "text-blue-700"
      : "text-gray-900";

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-gradient-to-br ${wrapperClass} p-5 shadow-sm`}
    >
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className={`mt-3 text-3xl font-bold tracking-tight ${valueClass}`}>
        {value}
      </div>
      {subValue ? <div className="mt-2 text-sm text-gray-500">{subValue}</div> : null}
    </div>
  );
}

function SummaryList({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>

      <div className="space-y-4 p-6">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start justify-between gap-6 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
          >
            <div className="text-sm font-medium text-gray-600">{item.label}</div>
            <div className="text-right text-sm font-semibold text-gray-900">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancialTable({
  title,
  rows,
  firstColumnLabel,
  revenueLabel,
  costLabel,
}: {
  title: string;
  rows: FinancialRow[];
  firstColumnLabel: string;
  revenueLabel: string;
  costLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-10 text-sm text-gray-500">No data available.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{firstColumnLabel}</th>
                <th className="px-6 py-3 font-medium">Leads</th>
                <th className="px-6 py-3 font-medium">{revenueLabel}</th>
                <th className="px-6 py-3 font-medium">{costLabel}</th>
                <th className="px-6 py-3 font-medium">Profit</th>
                <th className="px-6 py-3 font-medium">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                  <td className="px-6 py-4">{row.leads}</td>
                  <td className="px-6 py-4 text-green-700">{currency(row.revenue)}</td>
                  <td className="px-6 py-4 text-red-700">{currency(row.cost)}</td>
                  <td className="px-6 py-4 text-blue-700">{currency(row.profit)}</td>
                  <td className="px-6 py-4">
                    {row.marginPct === null ? "—" : `${row.marginPct.toFixed(2)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function AccountingPage({
  searchParams,
}: {
  searchParams?: Promise<{
    range?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const range = resolvedSearchParams.range || "all";
  const from = resolvedSearchParams.from || "";
  const to = resolvedSearchParams.to || "";

  const { startDate, endDate } = getDateBounds(range, from, to);

  const where =
    startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : undefined;

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
      buyer: lead.assignedBuyer?.name || "unassigned",
      supplier: lead.supplier?.name || "unknown",
      campaign: lead.campaign?.name || "unknown",
      revenue,
      cost,
      profit,
    };
  });

  const buyerRows = buildGroupedRows(
    normalized.map((row: any) => ({
      key: row.buyer,
      revenue: row.revenue,
      cost: 0,
      profit: row.revenue,
    }))
  );

  const supplierRows = buildGroupedRows(
    normalized.map((row: any) => ({
      key: row.supplier,
      revenue: 0,
      cost: row.cost,
      profit: -row.cost,
    }))
  );

  const campaignRows = buildGroupedRows(
    normalized.map((row: any) => ({
      key: row.campaign,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
    }))
  );

  const totalRevenue = normalized.reduce((sum, row) => sum + row.revenue, 0);
  const totalCost = normalized.reduce((sum, row) => sum + row.cost, 0);
  const totalProfit = normalized.reduce((sum, row) => sum + row.profit, 0);
  const totalMargin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;

  const topBuyer = getTopRow(buyerRows);
  const topSupplier = getTopRow(supplierRows);
  const topCampaign = getTopRow(campaignRows);

  const rangeOptions: RangeOption[] = [
    { key: "all", label: "All Time" },
    { key: "24h", label: "Last 24h" },
    { key: "7d", label: "Last 7d" },
    { key: "30d", label: "Last 30d" },
  ];

  const usingCustomRange = Boolean(from || to);

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
              {rangeOptions.map((option) => {
                const isActive = !usingCustomRange && range === option.key;

                return (
                  <Link
                    key={option.key}
                    href={
                      option.key === "all"
                        ? "/accounting"
                        : `/accounting?range=${option.key}`
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

          <form
            action="/accounting"
            method="get"
            className="mt-5 grid gap-4 md:grid-cols-4"
          >
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

            <div className="flex items-end gap-3 md:col-span-2">
              <button
                type="submit"
                className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Apply Custom Range
              </button>

              <Link
                href="/accounting"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Clear
              </Link>
            </div>
          </form>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Sell" value={currency(totalRevenue)} tone="green" />
          <StatCard label="Total Buy" value={currency(totalCost)} tone="red" />
          <StatCard label="Profit" value={currency(totalProfit)} tone="blue" />
          <StatCard
            label="Margin"
            value={totalMargin === null ? "—" : `${totalMargin.toFixed(2)}%`}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <FinancialTable
            title="Buyer Receivables"
            rows={buyerRows}
            firstColumnLabel="Buyer"
            revenueLabel="Amount Due"
            costLabel="Amount Owed"
          />

          <FinancialTable
            title="Supplier Payables"
            rows={supplierRows}
            firstColumnLabel="Supplier"
            revenueLabel="Amount Due"
            costLabel="Amount Owed"
          />

          <FinancialTable
            title="Campaign Financials"
            rows={campaignRows}
            firstColumnLabel="Campaign"
            revenueLabel="Revenue"
            costLabel="Cost"
          />
        </div>

        <div className="space-y-6">
          <SummaryList
            title="Top Financial Drivers"
            items={[
              {
                label: "Top Buyer Receivable",
                value: topBuyer
                  ? `${topBuyer.key} (${currency(topBuyer.revenue)})`
                  : "—",
              },
              {
                label: "Top Supplier Payable",
                value: topSupplier
                  ? `${topSupplier.key} (${currency(topSupplier.cost)})`
                  : "—",
              },
              {
                label: "Top Campaign Profit",
                value: topCampaign
                  ? `${topCampaign.key} (${currency(topCampaign.profit)})`
                  : "—",
              },
            ]}
          />

          <SummaryList
            title="Accounting Notes"
            items={[
              {
                label: "Buyer Receivables",
                value: "Based on assigned buyer pricePerLead",
              },
              {
                label: "Supplier Payables",
                value: "Based on lead cost",
              },
              {
                label: "Campaign Profit",
                value: "Revenue minus cost at lead level",
              },
              {
                label: "Date Filter Mode",
                value: usingCustomRange
                  ? `Custom (${from || "—"} → ${to || "—"})`
                  : rangeOptions.find((option) => option.key === range)?.label || "All Time",
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}