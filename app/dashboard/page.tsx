import { db } from "@/lib/db";
import { requireCurrentUser, isPlatformAdmin } from "@/lib/session-user";

function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

export default async function DashboardPage() {
  const user = await requireCurrentUser();

  const leads = await db.lead.findMany({
    where: isPlatformAdmin(user)
      ? {}
      : { organizationId: user.organizationId },
  });

  const totalLeads = leads.length;

  const totalRevenue = leads.reduce(
    (sum: number, l: any) => sum + (Number(l.cost) + Number(l.profit)),
    0
  );

  const totalCost = leads.reduce(
    (sum: number, l: any) => sum + Number(l.cost),
    0
  );

  const totalProfit = leads.reduce(
    (sum: number, l: any) => sum + Number(l.profit),
    0
  );

  const margin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <div className="mt-4 grid grid-cols-4 gap-4">
          <div>Leads: {totalLeads}</div>
          <div>Revenue: {currency(totalRevenue)}</div>
          <div>Cost: {currency(totalCost)}</div>
          <div>
            Profit: {currency(totalProfit)} (
            {margin ? margin.toFixed(2) + "%" : "—"})
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 text-sm text-gray-600">
        Welcome to RouteIQ. This will become your command center for:
        <ul className="mt-3 list-disc pl-5">
          <li>Live routing performance</li>
          <li>Buyer acceptance rates</li>
          <li>Supplier quality</li>
          <li>Profit optimization</li>
        </ul>
      </div>
    </div>
  );
}