import { db } from "@/lib/db";
import { applyPostbackTemplate } from "@/lib/tracking-postback";

function firstValue(values: Array<string | null | undefined>) {
  return values.find((value) => value !== null && typeof value !== "undefined" && value !== "") || null;
}

function toNumber(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function calculateMarginPct(revenue: number, cost: number) {
  if (revenue <= 0) return 0;
  return ((revenue - cost) / revenue) * 100;
}

function getPayloadValue(payload: Record<string, unknown>, keys: string[]) {
  return firstValue(
    keys.map((key) => {
      const value = payload[key];
      if (value === null || typeof value === "undefined") return null;
      return String(value);
    })
  );
}

async function getPayload(req: Request) {
  const url = new URL(req.url);
  const payload: Record<string, unknown> = {};

  url.searchParams.forEach((value, key) => {
    payload[key] = value;
  });

  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      Object.assign(payload, body || {});
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      form.forEach((value, key) => {
        payload[key] = typeof value === "string" ? value : String(value);
      });
    }
  }

  return payload;
}

async function handleSoldPostback(req: Request) {
  const payload = await getPayload(req);

  const clickId = getPayloadValue(payload, ["click_id", "clickId", "clickid"]);
  const leadId = getPayloadValue(payload, ["lead_id", "leadId"]);
  const postbackKey =
    req.headers.get("x-postback-key") ||
    getPayloadValue(payload, ["postback_key", "postbackKey"]);

  if (!clickId && !leadId) {
    return Response.json(
      { error: "click_id or lead_id is required" },
      { status: 400 }
    );
  }

  if (!postbackKey) {
    return Response.json(
      { error: "postback_key is required" },
      { status: 401 }
    );
  }

  const lead = await db.lead.findFirst({
    where: leadId
      ? { id: leadId }
      : {
          clickId,
        },
    include: {
      trackingLink: true,
      campaign: true,
    },
  });

  if (!lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!lead.trackingLinkId || !lead.trackingLink) {
    return Response.json(
      { error: "Lead is not associated with a tracking link" },
      { status: 400 }
    );
  }

  if (lead.trackingLink.postbackSecret !== postbackKey) {
    return Response.json({ error: "Invalid postback key" }, { status: 401 });
  }

  const revenue =
    toNumber(
      getPayloadValue(payload, ["revenue", "payout", "amount", "sale_amount"])
    ) ?? 0;
  const cost =
    toNumber(getPayloadValue(payload, ["cost"])) ?? toNumber(lead.cost) ?? 0;
  const profit = revenue - cost;
  const marginPct = calculateMarginPct(revenue, cost);

  const updatedLead = await db.lead.update({
    where: { id: lead.id },
    data: {
      cost,
      profit,
      marginPct,
    },
  });

  const shouldSendPublisherPostback =
    lead.trackingLink.publisherPostbackEnabled &&
    Boolean(lead.trackingLink.publisherPostbackUrl);

  let outboundStatus = "skipped";
  let outboundStatusCode: number | null = null;
  let outboundResponse = "";
  let outboundError = "";
  let targetUrl = "";

  if (shouldSendPublisherPostback && lead.trackingLink.publisherPostbackUrl) {
    targetUrl = applyPostbackTemplate(lead.trackingLink.publisherPostbackUrl, {
      click_id: lead.clickId,
      clickId: lead.clickId,
      lead_id: lead.id,
      leadId: lead.id,
      revenue,
      payout: revenue,
      amount: revenue,
      cost,
      profit,
      publisher_id: lead.publisherId,
      publisherId: lead.publisherId,
      sub_id: lead.subId,
      subId: lead.subId,
      tracking_link_id: lead.trackingLinkId,
      trackingLinkId: lead.trackingLinkId,
    });

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
      });

      outboundStatusCode = response.status;
      outboundResponse = await response.text();
      outboundStatus = response.ok ? "success" : "failed";
    } catch (error) {
      outboundStatus = "failed";
      outboundError =
        error instanceof Error ? error.message : "Publisher postback failed";
    }
  }

  await db.conversionPostback.create({
    data: {
      organizationId: lead.organizationId,
      trackingLinkId: lead.trackingLinkId,
      leadId: lead.id,
      clickId: lead.clickId,
      eventType: "sold",
      source: getPayloadValue(payload, ["source", "provider", "network"]) || "external",
      revenue,
      cost,
      profit,
      targetUrl: targetUrl || null,
      status: outboundStatus,
      statusCode: outboundStatusCode,
      responseBody: outboundResponse || null,
      error: outboundError || null,
    },
  });

  return Response.json({
    data: {
      leadId: updatedLead.id,
      clickId: updatedLead.clickId,
      revenue,
      cost,
      profit,
      marginPct,
      publisherPostback: {
        sent: shouldSendPublisherPostback,
        status: outboundStatus,
        statusCode: outboundStatusCode,
      },
    },
  });
}

export async function GET(req: Request) {
  try {
    return await handleSoldPostback(req);
  } catch (error) {
    console.error("Sold postback GET error:", error);
    return Response.json(
      { error: "Failed to process sold postback" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    return await handleSoldPostback(req);
  } catch (error) {
    console.error("Sold postback POST error:", error);
    return Response.json(
      { error: "Failed to process sold postback" },
      { status: 500 }
    );
  }
}
