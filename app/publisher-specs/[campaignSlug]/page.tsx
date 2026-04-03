import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  buildInboundFieldSelection,
  buildInboundSamplePayload,
} from "@/lib/inbound-spec";

type PageProps = {
  params: Promise<{
    campaignSlug: string;
  }>;
  searchParams?: Promise<{
    supplierId?: string;
  }>;
};

function prettifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const proto = headerStore.get("x-forwarded-proto") || "https";
  const host = headerStore.get("host");
  return host ? `${proto}://${host}` : "";
}

export default async function PublisherSpecPage({
  params,
  searchParams,
}: PageProps) {
  const { campaignSlug } = await params;
  const supplierId = (await searchParams)?.supplierId;

  if (!supplierId) {
    notFound();
  }

  const campaign = await db.campaign.findFirst({
    where: {
      slug: campaignSlug,
      status: "active",
    },
  });

  if (!campaign) {
    notFound();
  }

  const supplier = await db.supplier.findFirst({
    where: {
      id: supplierId,
      organizationId: campaign.organizationId,
      status: "active",
    },
  });

  if (!supplier) {
    notFound();
  }

  const origin = await getRequestOrigin();
  const endpointUrl = `${origin}/api/inbound/leads`;
  const fieldSelection = buildInboundFieldSelection({
    requiredFields: campaign.inboundRequiredFields,
    optionalFields: campaign.inboundOptionalFields,
  }).filter((field) => field.status !== "hidden");

  const samplePayload = buildInboundSamplePayload({
    campaignSlug: campaign.slug,
    source: supplier.trafficSource,
    requiredFields: campaign.inboundRequiredFields,
    optionalFields: campaign.inboundOptionalFields,
  });

  const curlExample = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${supplier.apiKey}" \\
  -d '${JSON.stringify(samplePayload)}'`;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
            RouteIQ Publisher Spec
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {campaign.name} Posting Instructions
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Use this specification to post leads into RouteIQ for the{" "}
            <span className="font-medium text-slate-900">{campaign.name}</span>{" "}
            campaign. This version is specific to supplier{" "}
            <span className="font-medium text-slate-900">{supplier.name}</span>.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Endpoint Details
            </h2>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="font-medium text-slate-900">Method</div>
                <div className="mt-1 rounded-xl bg-slate-50 p-3 font-mono text-xs">
                  POST
                </div>
              </div>
              <div>
                <div className="font-medium text-slate-900">Endpoint</div>
                <div className="mt-1 rounded-xl bg-slate-50 p-3 font-mono text-xs break-all">
                  {endpointUrl}
                </div>
              </div>
              <div>
                <div className="font-medium text-slate-900">Required Header</div>
                <div className="mt-1 rounded-xl bg-slate-50 p-3 font-mono text-xs break-all">
                  {`x-api-key: ${supplier.apiKey}`}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Campaign Summary
            </h2>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div>
                <span className="font-medium text-slate-900">Campaign:</span>{" "}
                {campaign.name}
              </div>
              <div>
                <span className="font-medium text-slate-900">Slug:</span>{" "}
                {campaign.slug}
              </div>
              <div>
                <span className="font-medium text-slate-900">Vertical:</span>{" "}
                {campaign.vertical}
              </div>
              <div>
                <span className="font-medium text-slate-900">Supplier:</span>{" "}
                {supplier.name}
              </div>
              <div>
                <span className="font-medium text-slate-900">
                  Default Source:
                </span>{" "}
                {supplier.trafficSource || "none"}
              </div>
            </div>
          </div>
        </div>

        {campaign.publisherSpecNotes ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
            <div className="font-semibold">Publisher Notes</div>
            <div className="mt-2 whitespace-pre-wrap leading-6">
              {campaign.publisherSpecNotes}
            </div>
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Required Request Structure
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Field</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Example</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    campaignSlug
                  </td>
                  <td className="px-4 py-3 text-slate-700">Required</td>
                  <td className="px-4 py-3 text-slate-700">
                    Tells RouteIQ which campaign should receive the lead.
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {campaign.slug}
                  </td>
                </tr>
                {fieldSelection.map((field) => (
                  <tr key={field.key} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {field.key}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {field.status === "required" ? "Required" : "Optional"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {field.description}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {field.example}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Sample JSON Payload
            </h2>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-800">
              {prettifyJson(samplePayload)}
            </pre>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              cURL Example
            </h2>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-800">
              {curlExample}
            </pre>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Success Response
          </h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-800">
            {prettifyJson({
              success: true,
              leadId: "lead_id_here",
              routingStatus: "pending",
            })}
          </pre>
        </div>
      </div>
    </div>
  );
}
