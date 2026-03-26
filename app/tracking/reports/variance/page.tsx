import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentUser, isPlatformAdmin } from "@/lib/session-user";

type GroupByOption = "campaign" | "link" | "source" | "publisher" | "subId";

type VarianceRow = {
  key: string;
  periodAClicks: number;
  periodASpend: number;
  periodAAvgCpc: number | null;
  periodBClicks: number;
  periodBSpend: number;
  periodBAvgCpc: number | null;
  deltaClicks: number;
  deltaSpend: number;
  deltaAvgCpc: number | null;
  deltaClicksPct: number | null;
  deltaSpendPct: number | null;
  deltaAvgCpcPct: number | null;
};

function currency(value: number) {
  return `$${value.toFixed(4)}`;
}

function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

function signedNumber(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function signedCurrency(value: number) {
  return value > 0
    ? `+$${value.toFixed(4)}`
    : value < 0
      ? `-$${Math.abs(value).toFixed(4)}`
      : `$0.0000`;
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

function pctChange(current: number, prior: number) {
  if (prior === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - prior) / Math.abs(prior)) * 100;
}

function getGroupLabel(groupBy: GroupByOption) {
  if (groupBy === "campaign") return "Campaign";
  if (groupBy === "link") return "Tracking Link";
  if (groupBy === "source") return "Traffic Source";
  if (groupBy === "publisher") return "Publisher";
  return "Sub ID";
}

function getGroupValue(groupBy: GroupByOption, click: any) {
  if (groupBy === "campaign") return click.trackingCampaign?.name || "unknown";
  if (groupBy === "link")
    return click.trackingLink?.name || click.trackingLink?.slug || "unknown";
  if (groupBy === "source") return click.trafficSource || "unknown";
  if (groupBy === "publisher") return click.publisherId || "unknown";
  return click.subId || "unknown";
}

function deltaClass(value: number | null) {
  if (value === null || value === 0) return "text-gray-700";
  return value > 0 ? "text-green-700" : "text-red-700";
}

function clicksDeltaClass(value: number) {
  if (value === 0) return "text-gray-700";
  return value > 0 ? "text-green-700" : "text-red-700";
}

function spendDeltaClass(value: number) {
  if (value === 0) return "text-gray-700";
  return value > 0 ? "text-red-700" : "text-green-700";
}

function spendDeltaPctClass(value: number | null) {
  if (value === null || value === 0) return "text-gray-700";
  return value > 0 ? "text-red-700" : "text-green-700";
}

function avgCpc(clicks: number, spend: number) {
  return clicks > 0 ? spend / clicks : null;
}

function buildVarianceRows(
  groupBy: GroupByOption,
  periodAClicks: any[],
  periodBClicks: any[]
): VarianceRow[] {
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

  for (const click of periodAClicks) {
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

  for (const click of periodBClicks) {
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

  return Array.from(map.values())
    .map((row) => {
      const periodAAvgCpc = avgCpc(row.periodAClicks, row.periodASpend);
      const periodBAvgCpc = avgCpc(row.periodBClicks, row.periodBSpend);

      return {
        key: row.key,
        periodAClicks: row.periodAClicks,
        periodASpend: row.periodASpend,
        periodAAvgCpc,
        periodBClicks: row.periodBClicks,
        periodBSpend: row.periodBSpend,
        periodBAvgCpc,
        deltaClicks: row.periodAClicks - row.periodBClicks,
        deltaSpend: row.periodASpend - row.periodBSpend,
        deltaAvgCpc:
          periodAAvgCpc === null || periodBAvgCpc === null
            ? null
            : periodAAvgCpc - periodBAvgCpc,
        deltaClicksPct: pctChange(row.periodAClicks, row.periodBClicks),
        deltaSpendPct: pctChange(row.periodASpend, row.periodBSpend),
        deltaAvgCpcPct:
          periodAAvgCpc === null || periodBAvgCpc === null
            ? null
            : pctChange(periodAAvgCpc, periodBAvgCpc),
      };
    })
    .sort((a, b) => Math.abs(b.deltaSpend) - Math.abs(a.deltaSpend));
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

export default async function TrackingVariancePage({
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

  const { periodAFrom, periodATo, periodBFrom, periodBTo } =
    buildComparisonDefaults(
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

  const rows = buildVarianceRows(groupBy, periodAClicks, periodBClicks);

  const totals = rows.reduce(
    (acc, row) => {
      acc.periodAClicks += row.periodAClicks;
      acc.periodASpend += row.periodASpend;
      acc.periodBClicks += row.periodBClicks;
      acc.periodBSpend += row.periodBSpend;
      return acc;
    },
    {
      periodAClicks: 0,
      periodASpend: 0,
      periodBClicks: 0,
      periodBSpend: 0,
    }
  );

  const totalPeriodAAvgCpc = avgCpc(totals.periodAClicks, totals.periodASpend);
  const totalPeriodBAvgCpc = avgCpc(totals.periodBClicks, totals.periodBSpend);

  const totalDeltaClicks = totals.periodAClicks - totals.periodBClicks;
  const totalDeltaSpend = totals.periodASpend - totals.periodBSpend;
  const totalDeltaAvgCpc =
    totalPeriodAAvgCpc === null || totalPeriodBAvgCpc === null
      ? null
      : totalPeriodAAvgCpc - totalPeriodBAvgCpc;

  const totalDeltaClicksPct = pctChange(totals.periodAClicks, totals.periodBClicks);
  const totalDeltaSpendPct = pctChange(totals.periodASpend, totals.periodBSpend);
  const totalDeltaAvgCpcPct =
    totalPeriodAAvgCpc === null || totalPeriodBAvgCpc === null
      ? null
      : pctChange(totalPeriodAAvgCpc, totalPeriodBAvgCpc);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Link Tracking Suite
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Tracking Variance
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Compare two time periods by {getGroupLabel(groupBy).toLowerCase()} and identify click, spend, and CPC shifts.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/tracking/reports"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Standard Tracking Reports
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
                <option value="source">Traffic Source</option>
                <option value="campaign">Campaign</option>
                <option value="link">Tracking Link</option>
                <option value="publisher">Publisher</option>
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
                href="/tracking/reports/variance"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Reset
              </Link>
            </div>
          </form>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Period A Spend"
            value={currency(totals.periodASpend)}
            subValue={`${periodAFrom} → ${periodATo}`}
          />
          <SummaryCard
            label="Period B Spend"
            value={currency(totals.periodBSpend)}
            subValue={`${periodBFrom} → ${periodBTo}`}
          />
          <SummaryCard
            label="Spend Delta"
            value={signedCurrency(totalDeltaSpend)}
            subValue={signedPercent(totalDeltaSpendPct)}
          />
          <SummaryCard
            label="Click Delta"
            value={signedNumber(totalDeltaClicks)}
            subValue={signedPercent(totalDeltaClicksPct)}
          />
          <SummaryCard
            label="Avg CPC Delta"
            value={signedCurrency(totalDeltaAvgCpc ?? 0)}
            subValue={signedPercent(totalDeltaAvgCpcPct)}
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
          <table className="min-w-[1400px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{getGroupLabel(groupBy)}</th>

                <th className="px-6 py-3 font-medium">Clicks A</th>
                <th className="px-6 py-3 font-medium">Clicks B</th>
                <th className="px-6 py-3 font-medium">Δ Clicks</th>
                <th className="px-6 py-3 font-medium">% Δ Clicks</th>

                <th className="px-6 py-3 font-medium">Spend A</th>
                <th className="px-6 py-3 font-medium">Spend B</th>
                <th className="px-6 py-3 font-medium">Δ Spend</th>
                <th className="px-6 py-3 font-medium">% Δ Spend</th>

                <th className="px-6 py-3 font-medium">Avg CPC A</th>
                <th className="px-6 py-3 font-medium">Avg CPC B</th>
                <th className="px-6 py-3 font-medium">Δ Avg CPC</th>
                <th className="px-6 py-3 font-medium">% Δ Avg CPC</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No click data found for the selected comparison periods.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>

                    <td className="px-6 py-4">{row.periodAClicks}</td>
                    <td className="px-6 py-4">{row.periodBClicks}</td>
                    <td className={`px-6 py-4 font-medium ${clicksDeltaClass(row.deltaClicks)}`}>
                      {signedNumber(row.deltaClicks)}
                    </td>
                    <td className={`px-6 py-4 font-medium ${deltaClass(row.deltaClicksPct)}`}>
                      {signedPercent(row.deltaClicksPct)}
                    </td>

                    <td className="px-6 py-4">{currency(row.periodASpend)}</td>
                    <td className="px-6 py-4">{currency(row.periodBSpend)}</td>
                    <td className={`px-6 py-4 font-medium ${spendDeltaClass(row.deltaSpend)}`}>
                      {signedCurrency(row.deltaSpend)}
                    </td>
                    <td className={`px-6 py-4 font-medium ${spendDeltaPctClass(row.deltaSpendPct)}`}>
                      {signedPercent(row.deltaSpendPct)}
                    </td>

                    <td className="px-6 py-4">
                      {row.periodAAvgCpc === null ? "—" : currency(row.periodAAvgCpc)}
                    </td>
                    <td className="px-6 py-4">
                      {row.periodBAvgCpc === null ? "—" : currency(row.periodBAvgCpc)}
                    </td>
                    <td className={`px-6 py-4 font-medium ${spendDeltaClass(row.deltaAvgCpc ?? 0)}`}>
                      {row.deltaAvgCpc === null ? "—" : signedCurrency(row.deltaAvgCpc)}
                    </td>
                    <td className={`px-6 py-4 font-medium ${spendDeltaPctClass(row.deltaAvgCpcPct)}`}>
                      {signedPercent(row.deltaAvgCpcPct)}
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