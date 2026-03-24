import { db } from "@/lib/db";

type FailureRow = {
  key: string;
  count: number;
};

function buildCountRows(keys: string[]) {
  const map = new Map<string, number>();

  for (const key of keys) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "success" || status === "accepted"
      ? "bg-green-100 text-green-800"
      : status === "failed" ||
        status === "error" ||
        status === "timeout" ||
        status === "invalid_response"
      ? "bg-red-100 text-red-800"
      : "bg-gray-200 text-gray-800";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
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
  tone?: "default" | "red";
}) {
  const wrapperClass =
    tone === "red"
      ? "from-white to-red-50"
      : "from-white to-gray-50";

  const valueClass = tone === "red" ? "text-red-700" : "text-gray-900";

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

function CountTable({
  title,
  rows,
  firstColumnLabel,
}: {
  title: string;
  rows: FailureRow[];
  firstColumnLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-10 text-sm text-gray-500">
          No data available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{firstColumnLabel}</th>
                <th className="px-6 py-3 font-medium">Failures</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{row.key}</td>
                  <td className="px-6 py-4 font-medium text-red-700">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function MonitoringPage() {
  const [recentDeliveries, recentPings] = await Promise.all([
    db.delivery.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        buyer: true,
        lead: {
          include: {
            campaign: true,
            supplier: true,
          },
        },
      },
    }),
    db.pingResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        buyer: true,
        lead: {
          include: {
            campaign: true,
            supplier: true,
          },
        },
      },
    }),
  ]);

  const failedDeliveries = recentDeliveries.filter((d: any) => d.status !== "success");
  const failedPings = recentPings.filter((p: any) =>
    ["error", "timeout", "invalid_response"].includes(p.status)
  );

  const deliveryFailureCampaigns = buildCountRows(
    failedDeliveries.map((d: any) => d.lead.campaign?.name || "Unknown Campaign")
  );

  const deliveryFailureBuyers = buildCountRows(
    failedDeliveries.map((d: any) => d.buyer?.name || "Unknown Buyer")
  );

  const pingFailureCampaigns = buildCountRows(
    failedPings.map((p: any) => p.lead.campaign?.name || "Unknown Campaign")
  );

  const pingFailureBuyers = buildCountRows(
    failedPings.map((p: any) => p.buyer?.name || "Unknown Buyer")
  );

  const totalRecentDeliveries = recentDeliveries.length;
  const totalRecentPings = recentPings.length;
  const deliveryFailureCount = failedDeliveries.length;
  const pingFailureCount = failedPings.length;

  const deliveryFailureRate =
    totalRecentDeliveries > 0
      ? (deliveryFailureCount / totalRecentDeliveries) * 100
      : 0;

  const pingFailureRate =
    totalRecentPings > 0 ? (pingFailureCount / totalRecentPings) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Monitoring
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Routing Health Monitor
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Watch recent routing health, ping failures, delivery failures, and operational
            pressure by campaign and buyer.
          </p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Recent Deliveries"
            value={totalRecentDeliveries}
          />

          <StatCard
            label="Delivery Failures"
            value={deliveryFailureCount}
            subValue={`${deliveryFailureRate.toFixed(2)}% failure rate`}
            tone="red"
          />

          <StatCard
            label="Recent Pings"
            value={totalRecentPings}
          />

          <StatCard
            label="Ping Failures"
            value={pingFailureCount}
            subValue={`${pingFailureRate.toFixed(2)}% failure rate`}
            tone="red"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Delivery Failures
            </h2>
          </div>

          {failedDeliveries.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500">
              No recent delivery failures.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Campaign</th>
                    <th className="px-6 py-3 font-medium">Buyer</th>
                    <th className="px-6 py-3 font-medium">Supplier</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {failedDeliveries.map((delivery: any) => (
                    <tr
                      key={delivery.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-gray-500">
                        {delivery.createdAt.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {delivery.lead.campaign?.name || "—"}
                      </td>
                      <td className="px-6 py-4">{delivery.buyer?.name || "—"}</td>
                      <td className="px-6 py-4">
                        {delivery.lead.supplier?.name || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={delivery.status} />
                      </td>
                      <td className="px-6 py-4">{delivery.statusCode ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Ping Failures
            </h2>
          </div>

          {failedPings.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500">
              No recent ping failures.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Campaign</th>
                    <th className="px-6 py-3 font-medium">Buyer</th>
                    <th className="px-6 py-3 font-medium">Supplier</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {failedPings.map((ping: any) => (
                    <tr
                      key={ping.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-gray-500">
                        {ping.createdAt.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {ping.lead.campaign?.name || "—"}
                      </td>
                      <td className="px-6 py-4">{ping.buyer?.name || "—"}</td>
                      <td className="px-6 py-4">
                        {ping.lead.supplier?.name || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={ping.status} />
                      </td>
                      <td className="max-w-[320px] px-6 py-4 whitespace-pre-wrap break-words text-gray-700">
                        {ping.error || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CountTable
          title="Delivery Failures by Campaign"
          rows={deliveryFailureCampaigns}
          firstColumnLabel="Campaign"
        />

        <CountTable
          title="Delivery Failures by Buyer"
          rows={deliveryFailureBuyers}
          firstColumnLabel="Buyer"
        />

        <CountTable
          title="Ping Failures by Campaign"
          rows={pingFailureCampaigns}
          firstColumnLabel="Campaign"
        />

        <CountTable
          title="Ping Failures by Buyer"
          rows={pingFailureBuyers}
          firstColumnLabel="Buyer"
        />
      </div>
    </div>
  );
}