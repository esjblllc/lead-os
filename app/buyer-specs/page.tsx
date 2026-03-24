import Link from "next/link";
import { db } from "@/lib/db";

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
  const params = (await searchParams) || {};

  const buyers = await db.buyer.findMany({
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
        <p className="mt-1 text-sm text-gray-600">
          Generate buyer ping/post integration specs, payload samples, and accepted response formats.
        </p>

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

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Buyer Summary</h2>

          {selectedBuyer ? (
            <div className="mt-4 space-y-2 text-sm">
              <div><span className="font-medium">Buyer:</span> {selectedBuyer.name}</div>
              <div><span className="font-medium">Company:</span> {selectedBuyer.companyName || "—"}</div>
              <div><span className="font-medium">Contact:</span> {selectedBuyer.contactName || "—"}</div>
              <div><span className="font-medium">Email:</span> {selectedBuyer.email || "—"}</div>
              <div><span className="font-medium">PPL:</span> {selectedBuyer.pricePerLead ? `$${Number(selectedBuyer.pricePerLead).toFixed(2)}` : "—"}</div>
              <div><span className="font-medium">Min Bid:</span> {selectedBuyer.minBid ? `$${Number(selectedBuyer.minBid).toFixed(2)}` : "—"}</div>
              <div><span className="font-medium">Timeout:</span> {selectedBuyer.timeoutMs ?? "—"}</div>
              <div><span className="font-medium">Status:</span> {selectedBuyer.status}</div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">No buyers found.</div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Configured Endpoints</h2>

          {selectedBuyer ? (
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="font-medium">Ping URL</div>
                <pre className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-3 text-xs">
{selectedBuyer.pingUrl || "—"}
                </pre>
              </div>

              <div>
                <div className="font-medium">Post URL</div>
                <pre className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-3 text-xs">
{selectedBuyer.postUrl || selectedBuyer.webhookUrl || "—"}
                </pre>
              </div>

              <div>
                <div className="font-medium">Accepted States</div>
                <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{selectedBuyer.acceptedStates || "—"}
                </pre>
              </div>

              <div>
                <div className="font-medium">Required Fields</div>
                <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{selectedBuyer.requiredFields || "—"}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">No buyers found.</div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Ping Request Payload</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{prettifyJson(pingPayload)}
          </pre>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Post Request Payload</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{prettifyJson(postPayload)}
          </pre>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Accepted Ping Response</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{prettifyJson(acceptedPingResponse)}
          </pre>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Rejected Ping Response</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{prettifyJson(rejectedPingResponse)}
          </pre>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Accepted Post Response</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{prettifyJson(acceptedPostResponse)}
          </pre>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Rejected Post Response</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{prettifyJson(rejectedPostResponse)}
          </pre>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Ping cURL Example</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{pingCurl}
          </pre>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Post cURL Example</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{postCurl}
          </pre>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Ping PowerShell Example</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{pingPowerShell}
          </pre>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Post PowerShell Example</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
{postPowerShell}
          </pre>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Validation Rules</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="font-medium">Ping Accepted</div>
            <div className="mt-1 text-gray-700">
              Your system treats a ping as accepted when the response includes <code>accept: true</code> and a valid numeric <code>bid</code>.
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <div className="font-medium">Post Accepted</div>
            <div className="mt-1 text-gray-700">
              Your system treats a post as accepted when the response includes one of: <code>accepted: true</code>, <code>accept: true</code>, <code>success: true</code>, <code>status: "accepted"</code>, or <code>result: "accepted"</code>.
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <div className="font-medium">HTTP 200 Alone Is Not Enough</div>
            <div className="mt-1 text-gray-700">
              A 200 response without a recognizable accepted response body will still be treated as failed.
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <div className="font-medium">Minimum Bid Handling</div>
            <div className="mt-1 text-gray-700">
              If the buyer returns a bid below the configured min bid, the ping will be treated as rejected.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}