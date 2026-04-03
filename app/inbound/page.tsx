import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  buildInboundFieldSelection,
  buildInboundSamplePayload,
} from "@/lib/inbound-spec";

type SearchParams = {
  supplierId?: string;
  campaignId?: string;
};

function prettifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default async function InboundPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) || {};
  const headerStore = await headers();
  const origin = `${
    headerStore.get("x-forwarded-proto") || "https"
  }://${headerStore.get("host") || "localhost:3000"}`;

  const [suppliers, campaigns] = await Promise.all([
    db.supplier.findMany({
      orderBy: { name: "asc" },
    }),
    db.campaign.findMany({
      orderBy: { name: "asc" },
      where: {
        status: "active",
      },
    }),
  ]);

  const selectedSupplier =
    suppliers.find((s: any) => s.id === params.supplierId) || suppliers[0] || null;

  const selectedCampaign =
    campaigns.find((c: any) => c.id === params.campaignId) || campaigns[0] || null;

  const endpointPath = "/api/inbound/leads";
  const campaignSlug = selectedCampaign?.slug || "your-campaign-slug";
  const apiKey = selectedSupplier?.apiKey || "PASTE_SUPPLIER_API_KEY_HERE";
  const samplePayload = buildInboundSamplePayload({
    campaignSlug,
    source: selectedSupplier?.trafficSource || "facebook",
    requiredFields: selectedCampaign?.inboundRequiredFields,
    optionalFields: selectedCampaign?.inboundOptionalFields,
  });

  const samplePayloadWithCost = {
    ...samplePayload,
    cost: 12.5,
  };

  const publisherSpecLink =
    selectedSupplier && selectedCampaign
      ? `${origin}/publisher-specs/${selectedCampaign.slug}?supplierId=${selectedSupplier.id}`
      : "";

  const fieldSelection = buildInboundFieldSelection({
    requiredFields: selectedCampaign?.inboundRequiredFields,
    optionalFields: selectedCampaign?.inboundOptionalFields,
  }).filter((field) => field.status !== "hidden");

  const curlExample = `curl -X POST "${origin}${endpointPath}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '${JSON.stringify(samplePayload)}'`;

  const powershellExample = `Invoke-RestMethod -Uri "${origin}${endpointPath}" \`
  -Method POST \`
  -Headers @{ "x-api-key" = "${apiKey}" } \`
  -ContentType "application/json" \`
  -Body '${JSON.stringify(samplePayload)}'`;

  const successResponse = {
    success: true,
    supplier: selectedSupplier?.name || "Supplier Name",
    campaign: selectedCampaign?.name || "Campaign Name",
    data: {
      id: "lead_id_here",
      routingStatus: "assigned",
    },
  };

  const errorResponse = {
    error: "Invalid API key",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Inbound Specs</h1>
        <p className="mt-1 text-sm text-gray-600">
          Generate supplier posting instructions and sample payloads for supplier traffic or your own landing pages.
        </p>

        <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4" method="get">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Supplier
            </label>
            <select
              name="supplierId"
              defaultValue={selectedSupplier?.id || ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {suppliers.map((supplier: any) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Campaign
            </label>
            <select
              name="campaignId"
              defaultValue={selectedCampaign?.id || ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {campaigns.map((campaign: any) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
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
              href="/inbound"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm text-gray-700 hover:bg-gray-100"
            >
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Supplier Summary</h2>

          {selectedSupplier ? (
            <div className="mt-4 space-y-2 text-sm">
              <div><span className="font-medium">Supplier:</span> {selectedSupplier.name}</div>
              <div><span className="font-medium">Traffic Source:</span> {selectedSupplier.trafficSource || "—"}</div>
              <div><span className="font-medium">Default Cost:</span> {selectedSupplier.defaultCost ? `$${Number(selectedSupplier.defaultCost).toFixed(2)}` : "—"}</div>
              <div><span className="font-medium">Status:</span> {selectedSupplier.status}</div>
              <div><span className="font-medium">API Key:</span></div>
              <pre className="whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-3 text-xs">
                {selectedSupplier.apiKey}
              </pre>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">No suppliers found.</div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Campaign Summary</h2>

          {selectedCampaign ? (
            <div className="mt-4 space-y-2 text-sm">
              <div><span className="font-medium">Campaign:</span> {selectedCampaign.name}</div>
              <div><span className="font-medium">Slug:</span> {selectedCampaign.slug}</div>
              <div><span className="font-medium">Vertical:</span> {selectedCampaign.vertical}</div>
              <div><span className="font-medium">Routing Mode:</span> {selectedCampaign.routingMode}</div>
              <div><span className="font-medium">Status:</span> {selectedCampaign.status}</div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">No campaigns found.</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Endpoint</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <div className="font-medium">Relative Endpoint</div>
            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
              {endpointPath}
            </pre>
          </div>

          <div>
            <div className="font-medium">Required Header</div>
            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
              {`x-api-key: ${apiKey}`}
            </pre>
          </div>

          {publisherSpecLink ? (
            <div>
              <div className="font-medium">Shareable Publisher Spec</div>
              <pre className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-3 text-xs">
                {publisherSpecLink}
              </pre>
              <Link
                href={publisherSpecLink}
                target="_blank"
                className="mt-3 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                Open Publisher Spec
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Campaign Field Requirements</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Field</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">campaignSlug</td>
                <td className="px-4 py-3">Required</td>
                <td className="px-4 py-3">
                  Always required to target the campaign.
                </td>
              </tr>
              {fieldSelection.map((field) => (
                <tr key={field.key} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium">{field.key}</td>
                  <td className="px-4 py-3">
                    {field.status === "required" ? "Required" : "Optional"}
                  </td>
                  <td className="px-4 py-3">{field.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Sample Payload</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
            {prettifyJson(samplePayload)}
          </pre>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Sample Payload with Explicit Cost</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
            {prettifyJson(samplePayloadWithCost)}
          </pre>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">cURL Example</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
            {curlExample}
          </pre>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">PowerShell Example</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
            {powershellExample}
          </pre>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Success Response Example</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
            {prettifyJson(successResponse)}
          </pre>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Error Response Example</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
            {prettifyJson(errorResponse)}
          </pre>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Field Notes</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="font-medium">campaignSlug</div>
            <div className="mt-1 text-gray-700">
              Recommended way to target a campaign externally.
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <div className="font-medium">cost</div>
            <div className="mt-1 text-gray-700">
              Optional. If omitted, the supplier’s default cost will be used.
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <div className="font-medium">source</div>
            <div className="mt-1 text-gray-700">
              Optional. If omitted, the supplier’s saved traffic source will be used.
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <div className="font-medium">subId / publisherId</div>
            <div className="mt-1 text-gray-700">
              Useful for downstream source and publisher attribution.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
