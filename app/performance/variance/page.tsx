import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentUser, isPlatformAdmin } from "@/lib/session-user";

type GroupByOption = "campaign" | "buyer" | "supplier" | "source" | "subId";

type VarianceRow = {
  key: string;
  periodALeads: number;
  periodARevenue: number;
  periodACost: number;
  periodAProfit: number;
  periodAMarginPct: number | null;
  periodBLeads: number;
  periodBRevenue: number;
  periodBCost: number;
  periodBProfit: number;
  periodBMarginPct: number | null;
  deltaLeads: number;
  deltaRevenue: number;
  deltaCost: number;
  deltaProfit: number;
  deltaMarginPct: number | null;
  deltaLeadsPct: number | null;
  deltaRevenuePct: number | null;
  deltaCostPct: number | null;
  deltaProfitPct: number | null;
};

function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

function signedNumber(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function signedCurrency(value: number) {
  return value > 0
    ? `+$${value.toFixed(2)}`
    : value < 0
      ? `-$${Math.abs(value).toFixed(2)}`
      : `$0.00`;
}

function signedPercent(value: number | null) {
  if (value === null) return "—";
  return value > 0 ? `+${value.toFixed(2)}%` : `${value.toFixed(2)}%`;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
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

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateBounds(from?: string, to?: string) {
  return {
    startDate: from ? new Date(`${from}T00:00:00`) : null,
    endDate: to ? new Date(`${to}T23:59:59.999`) : null,
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
    return {
      periodAFrom: finalAFrom,
      periodATo: finalATo,
      periodBFrom,
      periodBTo,
    };
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

function getGroupLabel(groupBy: GroupByOption) {
  if (groupBy === "campaign") return "Campaign";
  if (groupBy === "buyer") return "Buyer";
  if (groupBy === "supplier") return "Supplier";
  if (groupBy === "source") return "Source";
  return "Sub ID";
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

function deltaClass(value: number | null) {
  if (value === null || value === 0) return "text-gray-700";
  return value > 0 ? "text-green-700" : "text-red-700";
}

function deltaLeadsClass(value: number) {
  if (value === 0) return "text-gray-700";
  return value > 0 ? "text-green-700" : "text-red-700";
}

function costDeltaClass(value: number) {
  if (value === 0) return "text-gray-700";
  return value > 0 ? "text-red-700" : "text-green-700";
}

function costDeltaPctClass(value: number | null) {
  if (value === null || value === 0) return "text-gray-700";
  return value > 0 ? "text-red-700" : "text-green-700";
}

function buildVarianceRows(
  groupBy: GroupByOption,
  periodALeads: any[],
  periodBLeads: any[]
): VarianceRow[] {
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

  for (const lead of periodALeads) {
    const key = getGroupValue(groupBy, lead);
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

    const cost = toNumber(lead.cost);
    const profit = toNumber(lead.profit);
    const revenue = cost + profit;

    existing.periodALeads += 1;
    existing.periodARevenue += revenue;
    existing.periodACost += cost;
    existing.periodAProfit += profit;

    map.set(key, existing);
  }

  for (const lead of periodBLeads) {
    const key = getGroupValue(groupBy, lead);
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

    const cost = toNumber(lead.cost);
    const profit = toNumber(lead.profit);
    const revenue = cost + profit;

    existing.periodBLeads += 1;
    existing.periodBRevenue += revenue;
    existing.periodBCost += cost;
    existing.periodBProfit += profit;

    map.set(key, existing);
  }

  return Array.from(map.values())
    .map((row) => {
      const periodAMarginPct = marginPct(row.periodARevenue, row.periodAProfit);
      const periodBMarginPct = marginPct(row.periodBRevenue, row.periodBProfit);

      return {
        key: row.key,
        periodALeads: row.periodALeads,
        periodARevenue: row.periodARevenue,
        periodACost: row.periodACost,
        periodAProfit: row.periodAProfit,
        periodAMarginPct,
        periodBLeads: row.periodBLeads,
        periodBRevenue: row.periodBRevenue,
        periodBCost: row.periodBCost,
        periodBProfit: row.periodBProfit,
        periodBMarginPct,
        deltaLeads: row.periodALeads - row.periodBLeads,
        deltaRevenue: row.periodARevenue - row.periodBRevenue,
        deltaCost: row.periodACost - row.periodBCost,
        deltaProfit: row.periodAProfit - row.periodBProfit,
        deltaMarginPct:
          periodAMarginPct === null || periodBMarginPct === null
            ? null
            : periodAMarginPct - periodBMarginPct,
        deltaLeadsPct: pctChange(row.periodALeads, row.periodBLeads),
        deltaRevenuePct: pctChange(row.periodARevenue, row.periodBRevenue),
        deltaCostPct: pctChange(row.periodACost, row.periodBCost),
        deltaProfitPct: pctChange(row.periodAProfit, row.periodBProfit),
      };
    })
    .sort((a, b) => Math.abs(b.deltaProfit) - Math.abs(a.deltaProfit));
}

function SummaryCard({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
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

export default async function PerformanceVariancePage({
  searchParams,
}: {
  searchParams?: Promise<{
    periodAFrom?: string;
    periodATo?: string;
    periodBFrom?: string;
    periodBTo?: string;
    groupBy?: GroupByOption;
  }>;
}) {
  const user = await requireCurrentUser();
  const params = (await searchParams) || {};

  const groupBy: GroupByOption = params.groupBy || "subId";

  const {
    periodAFrom,
    periodATo,
    periodBFrom,
    periodBTo,
  } = buildComparisonDefaults(
    params.periodAFrom,
    params.periodATo,
    params.periodBFrom,
    params.periodBTo
  );

  const periodABounds = getDateBounds(periodAFrom, periodATo);
  const periodBBounds = getDateBounds(periodBFrom, periodBTo);

  const orgWhere = isPlatformAdmin(user)
    ? {}
    : { organizationId: user.organizationId };

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

  const rows = buildVarianceRows(groupBy, periodALeads, periodBLeads);

  const totals = rows.reduce(
    (acc, row) => {
      acc.periodALeads += row.periodALeads;
      acc.periodARevenue += row.periodARevenue;
      acc.periodACost += row.periodACost;
      acc.periodAProfit += row.periodAProfit;
      acc.periodBLeads += row.periodBLeads;
      acc.periodBRevenue += row.periodBRevenue;
      acc.periodBCost += row.periodBCost;
      acc.periodBProfit += row.periodBProfit;
      return acc;
    },
    {
      periodALeads: 0,
      periodARevenue: 0,
      periodACost: 0,
      periodAProfit: 0,
      periodBLeads: 0,
      periodBRevenue: 0,
      periodBCost: 0,
      periodBProfit: 0,
    }
  );

  const totalPeriodAMarginPct = marginPct(totals.periodARevenue, totals.periodAProfit);
  const totalPeriodBMarginPct = marginPct(totals.periodBRevenue, totals.periodBProfit);

  const totalDeltaLeads = totals.periodALeads - totals.periodBLeads;
  const totalDeltaRevenue = totals.periodARevenue - totals.periodBRevenue;
  const totalDeltaCost = totals.periodACost - totals.periodBCost;
  const totalDeltaProfit = totals.periodAProfit - totals.periodBProfit;

  const totalDeltaLeadsPct = pctChange(totals.periodALeads, totals.periodBLeads);
  const totalDeltaRevenuePct = pctChange(totals.periodARevenue, totals.periodBRevenue);
  const totalDeltaCostPct = pctChange(totals.periodACost, totals.periodBCost);
  const totalDeltaProfitPct = pctChange(totals.periodAProfit, totals.periodBProfit);

  const totalDeltaMarginPct =
    totalPeriodAMarginPct === null || totalPeriodBMarginPct === null
      ? null
      : totalPeriodAMarginPct - totalPeriodBMarginPct;

  const exportHref =
    `/api/reports/performance-variance/export?periodAFrom=${encodeURIComponent(
      periodAFrom
    )}&periodATo=${encodeURIComponent(
      periodATo
    )}&periodBFrom=${encodeURIComponent(
      periodBFrom
    )}&periodBTo=${encodeURIComponent(
      periodBTo
    )}&groupBy=${encodeURIComponent(groupBy)}`;

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
                Variance Reporting
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Compare two time periods by {getGroupLabel(groupBy).toLowerCase()} and identify volume, revenue, cost, profit, and margin changes.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/performance"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Standard Reports
              </Link>
            </div>
          </div>

          <form method="get" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Period A From
              </label>
              <input
                type="date"
                name="periodAFrom"
                defaultValue={periodAFrom}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Period A To
              </label>
              <input
                type="date"
                name="periodATo"
                defaultValue={periodATo}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Period B From
              </label>
              <input
                type="date"
                name="periodBFrom"
                defaultValue={periodBFrom}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Period B To
              </label>
              <input
                type="date"
                name="periodBTo"
                defaultValue={periodBTo}
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
                <option value="subId">Sub ID</option>
                <option value="source">Source</option>
                <option value="campaign">Campaign</option>
                <option value="buyer">Buyer</option>
                <option value="supplier">Supplier</option>
              </select>
            </div>

            <div className="flex items-end gap-3 md:col-span-2 xl:col-span-5">
              <button
                type="submit"
                className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Compare Periods
              </button>

              <Link
                href={exportHref}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Export CSV
              </Link>

              <Link
                href="/performance/variance"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Reset
              </Link>
            </div>
          </form>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Period A Profit"
            value={currency(totals.periodAProfit)}
            subValue={`${periodAFrom} → ${periodATo}`}
          />
          <SummaryCard
            label="Period B Profit"
            value={currency(totals.periodBProfit)}
            subValue={`${periodBFrom} → ${periodBTo}`}
          />
          <SummaryCard
            label="Profit Delta"
            value={signedCurrency(totalDeltaProfit)}
            subValue={signedPercent(totalDeltaProfitPct)}
          />
          <SummaryCard
            label="Lead Delta"
            value={signedNumber(totalDeltaLeads)}
            subValue={signedPercent(totalDeltaLeadsPct)}
          />
          <SummaryCard
            label="Margin Delta"
            value={signedPercent(totalDeltaMarginPct)}
            subValue={`${percent(totalPeriodAMarginPct)} vs ${percent(totalPeriodBMarginPct)}`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {getGroupLabel(groupBy)} Variance
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1800px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{getGroupLabel(groupBy)}</th>

                <th className="px-6 py-3 font-medium">Leads A</th>
                <th className="px-6 py-3 font-medium">Leads B</th>
                <th className="px-6 py-3 font-medium">Δ Leads</th>
                <th className="px-6 py-3 font-medium">% Δ Leads</th>

                <th className="px-6 py-3 font-medium">Revenue A</th>
                <th className="px-6 py-3 font-medium">Revenue B</th>
                <th className="px-6 py-3 font-medium">Δ Revenue</th>
                <th className="px-6 py-3 font-medium">% Δ Revenue</th>

                <th className="px-6 py-3 font-medium">Cost A</th>
                <th className="px-6 py-3 font-medium">Cost B</th>
                <th className="px-6 py-3 font-medium">Δ Cost</th>
                <th className="px-6 py-3 font-medium">% Δ Cost</th>

                <th className="px-6 py-3 font-medium">Profit A</th>
                <th className="px-6 py-3 font-medium">Profit B</th>
                <th className="px-6 py-3 font-medium">Δ Profit</th>
                <th className="px-6 py-3 font-medium">% Δ Profit</th>

                <th className="px-6 py-3 font-medium">Margin A</th>
                <th className="px-6 py-3 font-medium">Margin B</th>
                <th className="px-6 py-3 font-medium">Δ Margin</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={20}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No lead data found for the selected comparison periods.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>

                    <td className="px-6 py-4">{row.periodALeads}</td>
                    <td className="px-6 py-4">{row.periodBLeads}</td>
                    <td className={`px-6 py-4 font-medium ${deltaLeadsClass(row.deltaLeads)}`}>
                      {signedNumber(row.deltaLeads)}
                    </td>
                    <td className={`px-6 py-4 font-medium ${deltaClass(row.deltaLeadsPct)}`}>
                      {signedPercent(row.deltaLeadsPct)}
                    </td>

                    <td className="px-6 py-4">{currency(row.periodARevenue)}</td>
                    <td className="px-6 py-4">{currency(row.periodBRevenue)}</td>
                    <td className={`px-6 py-4 font-medium ${deltaClass(row.deltaRevenue)}`}>
                      {signedCurrency(row.deltaRevenue)}
                    </td>
                    <td className={`px-6 py-4 font-medium ${deltaClass(row.deltaRevenuePct)}`}>
                      {signedPercent(row.deltaRevenuePct)}
                    </td>

                    <td className="px-6 py-4">{currency(row.periodACost)}</td>
                    <td className="px-6 py-4">{currency(row.periodBCost)}</td>
                    <td className={`px-6 py-4 font-medium ${costDeltaClass(row.deltaCost)}`}>
                      {signedCurrency(row.deltaCost)}
                    </td>
                    <td className={`px-6 py-4 font-medium ${costDeltaPctClass(row.deltaCostPct)}`}>
                      {signedPercent(row.deltaCostPct)}
                    </td>

                    <td className="px-6 py-4">{currency(row.periodAProfit)}</td>
                    <td className="px-6 py-4">{currency(row.periodBProfit)}</td>
                    <td className={`px-6 py-4 font-medium ${deltaClass(row.deltaProfit)}`}>
                      {signedCurrency(row.deltaProfit)}
                    </td>
                    <td className={`px-6 py-4 font-medium ${deltaClass(row.deltaProfitPct)}`}>
                      {signedPercent(row.deltaProfitPct)}
                    </td>

                    <td className="px-6 py-4">{percent(row.periodAMarginPct)}</td>
                    <td className="px-6 py-4">{percent(row.periodBMarginPct)}</td>
                    <td className={`px-6 py-4 font-medium ${deltaClass(row.deltaMarginPct)}`}>
                      {signedPercent(row.deltaMarginPct)}
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