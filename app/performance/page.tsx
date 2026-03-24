import Link from "next/link";
import { db } from "@/lib/db";

type ReportRow = {
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
): ReportRow[] {
  const map = new Map<string, ReportRow>();

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

function getTopRow(rows: ReportRow[]) {
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
  tone?: "default" | "blue" | "orange" | "green";
}) {
  const toneClass =
    tone === "blue"
      ? "from-white to-blue-50"
      : tone === "orange"
      ? "from-white to-orange-50"
      : tone === "green"
      ? "from-white to-green-50"
      : "from-white to-gray-50";

  const valueClass =
    tone === "blue"
      ? "text-blue-700"
      : tone === "orange"
      ? "text-orange-700"
      : tone === "green"
      ? "text-green-700"
      : "text-gray-900";

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-gradient-to-br ${toneClass} p-5 shadow-sm`}
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

function ReportTable({
  title,
  rows,
  firstColumnLabel,
}: {
  title: string;
  rows: ReportRow[];
  firstColumnLabel: string;
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
                <th className="px-6 py-3 font-medium">Revenue</th>
                <th className="px-6 py-3 font-medium">Cost</th>
                <th className="px-6 py-3 font-medium">Profit</th>
                <th className="px-6 py-3 font-medium">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                  <td className="px-6 py-4">{row.leads}</td>
                  <td className="px-6 py-4 text-blue-700">{currency(row.revenue)}</td>
                  <td className="px-6 py-4 text-orange-700">{currency(row.cost)}</td>
                  <td className="px-6 py-4 text-green-700">{currency(row.profit)}</td>
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

export default async function PerformancePage({
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
    where, {
        ...where,
        routingStatus: "assigned",
    }
    orderBy: { createdAt: "desc" },
    include: {
      campaign: true,
      assignedBuyer: true,
      supplier: true,
    },
  });

  const normalized = leads.map((lead: any) => {
    const revenue = cost + profit;
    const cost = toNumber(lead.cost);
    const profit = toNumber(lead.profit);

    return {
      campaign: lead.campaign?.name || "unknown",
      buyer: lead.assignedBuyer?.name || "unassigned",
      supplier: lead.supplier?.name || "unknown",
      source: lead.source || "unknown",
      subId: lead.subId || "unknown",
      revenue,
      cost,
      profit,
    };
  });

  const campaignRows = buildGroupedRows(
    normalized.map((row: any) => ({
      key: row.campaign,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
    }))
  );

  const buyerRows = buildGroupedRows(
    normalized.map((row: any) => ({
      key: row.buyer,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
    }))
  );

  const supplierRows = buildGroupedRows(
    normalized.map((row: any) => ({
      key: row.supplier,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
    }))
  );

  const sourceRows = buildGroupedRows(
    normalized.map((row: any) => ({
      key: row.source,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
    }))
  );

  const subIdRows = buildGroupedRows(
    normalized.map((row: any) => ({
      key: row.subId,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
    }))
  );

  const totalLeads = leads.length;
  const totalRevenue = normalized.reduce((sum: number, row: any) => sum + row.revenue, 0);
  const totalCost = normalized.reduce((sum: number, row: any) => sum + row.cost, 0);
  const totalProfit = normalized.reduce((sum: number, row: any) => sum + row.profit, 0);
  const totalMargin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;

  const topCampaign = getTopRow(campaignRows);
  const topBuyer = getTopRow(buyerRows);
  const topSupplier = getTopRow(supplierRows);
  const topSource = getTopRow(sourceRows);
  const topSubId = getTopRow(subIdRows);

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
                Reports
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Performance Reporting
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Analyze lead economics by campaign, buyer, supplier, source, and sub ID.
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
                        ? "/performance"
                        : `/performance?range=${option.key}`
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
            action="/performance"
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
                href="/performance"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Clear
              </Link>
            </div>
          </form>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Leads" value={totalLeads} />
          <StatCard label="Revenue" value={currency(totalRevenue)} tone="blue" />
          <StatCard label="Cost" value={currency(totalCost)} tone="orange" />
          <StatCard
            label="Profit / Margin"
            value={currency(totalProfit)}
            subValue={totalMargin === null ? "—" : `${totalMargin.toFixed(2)}%`}
            tone="green"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <ReportTable
            title="Campaign Performance"
            rows={campaignRows}
            firstColumnLabel="Campaign"
          />

          <ReportTable
            title="Buyer Performance"
            rows={buyerRows}
            firstColumnLabel="Buyer"
          />

          <ReportTable
            title="Supplier Performance"
            rows={supplierRows}
            firstColumnLabel="Supplier"
          />

          <ReportTable
            title="Source Performance"
            rows={sourceRows}
            firstColumnLabel="Source"
          />

          <ReportTable
            title="Sub ID Performance"
            rows={subIdRows}
            firstColumnLabel="Sub ID"
          />
        </div>

        <div className="space-y-6">
          <SummaryList
            title="Top Performers"
            items={[
              {
                label: "Top Campaign by Profit",
                value: topCampaign
                  ? `${topCampaign.key} (${currency(topCampaign.profit)})`
                  : "—",
              },
              {
                label: "Top Buyer by Profit",
                value: topBuyer
                  ? `${topBuyer.key} (${currency(topBuyer.profit)})`
                  : "—",
              },
              {
                label: "Top Supplier by Profit",
                value: topSupplier
                  ? `${topSupplier.key} (${currency(topSupplier.profit)})`
                  : "—",
              },
              {
                label: "Top Source by Profit",
                value: topSource
                  ? `${topSource.key} (${currency(topSource.profit)})`
                  : "—",
              },
              {
                label: "Top Sub ID by Profit",
                value: topSubId
                  ? `${topSubId.key} (${currency(topSubId.profit)})`
                  : "—",
              },
            ]}
          />

          <SummaryList
            title="Reporting Notes"
            items={[
              {
                label: "Revenue Source",
                value: "Assigned buyer pricePerLead",
              },
              {
                label: "Cost Source",
                value: "Lead cost field",
              },
              {
                label: "Profit Source",
                value: "Lead profit field",
              },
              {
                label: "Grouping Logic",
                value: "Aggregated from filtered lead set",
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