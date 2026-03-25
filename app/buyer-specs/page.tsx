import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentUser, isPlatformAdmin } from "@/lib/session-user";

type SearchParams = {
  buyerId?: string;
};

function prettifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default async function BuyerSpecsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireCurrentUser();

  const params = (await searchParams) || {};

  const buyers = await db.buyer.findMany({
    where: isPlatformAdmin(user)
      ? undefined
      : {
          organizationId: user.organizationId,
        },
    orderBy: { name: "asc" },
  });

  const selectedBuyer =
    buyers.find((b: any) => b.id === params.buyerId) || buyers[0] || null;

  const pingPayload = {
    zip: "11746",
    state: "NY",
    source: "facebook",
    subId: "sub_123",
    publisherId: "pub_123",
  };

  const postPayload = {
    leadId: "lead_123",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "5551234567",
    state: "NY",
    zip: "11746",
    source: "facebook",
    subId: "sub_123",
    publisherId: "pub_123",
    campaignId: "camp_123",
    campaignName: "Auto Accident Campaign",
    buyerId: selectedBuyer?.id || "buyer_123",
    buyerName: selectedBuyer?.name || "Buyer Name",
    routingStatus: "assigned",
    createdAt: new Date().toISOString(),
    attemptNumber: 1,
  };

  const acceptedPingResponse = {
    accept: true,
    bid: 25.0,
    buyer: selectedBuyer?.name || "Buyer Name",
  };

  const rejectedPingResponse = {
    accept: false,
    reason: "Below bid threshold",
  };

  const acceptedPostResponse = {
    accepted: true,
    status: "accepted",
    lead_id: "buyer_lead_123",
    payout: 25.0,
  };

  const rejectedPostResponse = {
    accepted: false,
    status: "rejected",
    reason: "Duplicate lead",
  };

  const pingCurl = `curl -X POST "${selectedBuyer?.pingUrl || "https://buyer-ping.example.com"}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(pingPayload)}'`;

  const postCurl = `curl -X POST "${selectedBuyer?.postUrl || selectedBuyer?.webhookUrl || "https://buyer-post.example.com"}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(postPayload)}'`;

  const pingPowerShell = `Invoke-RestMethod -Uri "${selectedBuyer?.pingUrl || "https://buyer-ping.example.com"}" \`
  -Method POST \`
  -ContentType "application/json" \`
  -Body '${JSON.stringify(pingPayload)}'`;

  const postPowerShell = `Invoke-RestMethod -Uri "${selectedBuyer?.postUrl || selectedBuyer?.webhookUrl || "https://buyer-post.example.com"}" \`
  -Method POST \`
  -ContentType "application/json" \`
  -Body '${JSON.stringify(postPayload)}'`;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Buyer Specs</h1>

        <form className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-4" method="get">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Buyer
            </label>
            <select
              name="buyerId"
              defaultValue={selectedBuyer?.id || ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {buyers.map((buyer: any) => (
                <option key={buyer.id} value={buyer.id}>
                  {buyer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg border border-black bg-black px-4 py-2 text-sm text-white"
            >
              Generate Spec
            </button>
          </div>

          <div className="flex items-end">
            <Link
              href="/buyer-specs"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm text-gray-700 hover:bg-gray-100"
            >
              Reset
            </Link>
          </div>
        </form>
      </div>

      {!selectedBuyer && (
        <div className="rounded-xl border bg-white p-5 text-sm text-gray-500">
          No buyers available for your organization.
        </div>
      )}

      {selectedBuyer && (
        <>
          {/* KEEP ALL YOUR EXISTING UI BELOW — unchanged */}
        </>
      )}
    </div>
  );
}