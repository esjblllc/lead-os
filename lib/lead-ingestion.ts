import { db } from "@/lib/db";

function toNumber(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function calculateFinancials(cost: number | null, revenue: number | null) {
  if (revenue === null && cost === null) {
    return {
      profit: null,
      marginPct: null,
    };
  }

  const safeRevenue = revenue ?? 0;
  const safeCost = cost ?? 0;
  const profit = safeRevenue - safeCost;

  let marginPct: number | null = null;
  if (safeRevenue > 0) {
    marginPct = (profit / safeRevenue) * 100;
  }

  return {
    profit,
    marginPct,
  };
}

type PingAttemptResult = {
  buyerId: string;
  buyerName: string;
  status: "accepted" | "rejected" | "timeout" | "error" | "invalid_response";
  bid: number | null;
  response: string | null;
  error: string | null;
};

type DeliveryValidationResult = {
  accepted: boolean;
  storedResponse: string;
  statusCode: number;
};

function validateBuyerAcceptance(
  statusCode: number,
  rawText: string
): DeliveryValidationResult {
  const trimmed = (rawText || "").trim();

  let parsed: any = null;
  try {
    parsed = trimmed ? JSON.parse(trimmed) : null;
  } catch {
    parsed = null;
  }

  const httpOk = statusCode >= 200 && statusCode < 300;
  let accepted = false;

  if (httpOk) {
    if (parsed && typeof parsed === "object") {
      accepted =
        parsed.accepted === true ||
        parsed.accept === true ||
        parsed.success === true ||
        parsed.status === "accepted" ||
        parsed.result === "accepted";
    } else {
      const lower = trimmed.toLowerCase();
      accepted =
        lower === "accepted" ||
        lower === "success" ||
        lower === "ok" ||
        lower === "true";
    }
  }

  const storedResponse =
    parsed && typeof parsed === "object"
      ? JSON.stringify(parsed, null, 2)
      : trimmed || "No response body";

  return {
    accepted,
    storedResponse,
    statusCode,
  };
}

async function pingBuyer(
  buyer: {
    id: string;
    name: string;
    pingUrl: string | null;
    timeoutMs: number | null;
    minBid: unknown;
  },
  lead: {
    zip?: string | null;
    state?: string | null;
    source?: string | null;
    subId?: string | null;
    publisherId?: string | null;
  }
): Promise<PingAttemptResult> {
  if (!buyer.pingUrl) {
    return {
      buyerId: buyer.id,
      buyerName: buyer.name,
      status: "rejected",
      bid: null,
      response: null,
      error: "No pingUrl configured",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      buyer.timeoutMs ?? 1500
    );

    const res = await fetch(buyer.pingUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        zip: lead.zip,
        state: lead.state,
        source: lead.source,
        subId: lead.subId,
        publisherId: lead.publisherId,
      }),
    });

    clearTimeout(timeoutId);

    const text = await res.text();

    if (!res.ok) {
      return {
        buyerId: buyer.id,
        buyerName: buyer.name,
        status: "error",
        bid: null,
        response: text,
        error: `Ping returned HTTP ${res.status}`,
      };
    }

    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        buyerId: buyer.id,
        buyerName: buyer.name,
        status: "invalid_response",
        bid: null,
        response: text,
        error: "Ping response was not valid JSON",
      };
    }

    if (!json?.accept) {
      return {
        buyerId: buyer.id,
        buyerName: buyer.name,
        status: "rejected",
        bid: null,
        response: text,
        error: null,
      };
    }

    const bid = toNumber(json?.bid);
    if (bid === null) {
      return {
        buyerId: buyer.id,
        buyerName: buyer.name,
        status: "invalid_response",
        bid: null,
        response: text,
        error: "Accepted response missing valid bid",
      };
    }

    const minBid = toNumber(buyer.minBid);
    if (minBid !== null && bid < minBid) {
      return {
        buyerId: buyer.id,
        buyerName: buyer.name,
        status: "rejected",
        bid,
        response: text,
        error: `Bid ${bid} below minBid ${minBid}`,
      };
    }

    return {
      buyerId: buyer.id,
      buyerName: buyer.name,
      status: "accepted",
      bid,
      response: text,
      error: null,
    };
  } catch (err: any) {
    const aborted = err?.name === "AbortError";

    return {
      buyerId: buyer.id,
      buyerName: buyer.name,
      status: aborted ? "timeout" : "error",
      bid: null,
      response: null,
      error: aborted ? "Ping timed out" : err?.message ?? "Unknown ping error",
    };
  }
}

async function deliverLeadToBuyer(params: {
  lead: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    state: string | null;
    zip: string | null;
    source: string | null;
    subId: string | null;
    publisherId: string | null;
    cost: unknown;
    routingStatus: string;
    createdAt: Date;
    campaign: {
      id: string;
      name: string;
    };
    assignedBuyer: {
      id: string;
      name: string;
      webhookUrl: string | null;
      postUrl: string | null;
    } | null;
  };
  buyerId: string;
  postUrl: string;
}) {
  const maxAttempts = 2;
  let finalAccepted = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(params.postUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: params.lead.id,
          firstName: params.lead.firstName,
          lastName: params.lead.lastName,
          email: params.lead.email,
          phone: params.lead.phone,
          state: params.lead.state,
          zip: params.lead.zip,
          source: params.lead.source,
          subId: params.lead.subId,
          publisherId: params.lead.publisherId,
          campaignId: params.lead.campaign.id,
          campaignName: params.lead.campaign.name,
          buyerId: params.buyerId,
          buyerName: params.lead.assignedBuyer?.name ?? null,
          routingStatus: params.lead.routingStatus,
          createdAt: params.lead.createdAt,
          attemptNumber: attempt,
        }),
      });

      const rawText = await res.text();
      const validation = validateBuyerAcceptance(res.status, rawText);

      await db.delivery.create({
        data: {
          leadId: params.lead.id,
          buyerId: params.buyerId,
          status: validation.accepted ? "success" : "failed",
          response: validation.storedResponse,
          statusCode: validation.statusCode,
          attemptNumber: attempt,
        },
      });

      if (validation.accepted) {
        finalAccepted = true;
        break;
      }
    } catch (err: any) {
      await db.delivery.create({
        data: {
          leadId: params.lead.id,
          buyerId: params.buyerId,
          status: "failed",
          response: err?.message ?? "Unknown delivery error",
          attemptNumber: attempt,
        },
      });
    }
  }

  if (!finalAccepted) {
    const cost = toNumber(params.lead.cost);
    const unsoldFinancials = calculateFinancials(cost, null);

    await db.lead.update({
      where: { id: params.lead.id },
      data: {
        assignedBuyerId: null,
        routingStatus: "pending",
        profit: unsoldFinancials.profit,
        marginPct: unsoldFinancials.marginPct,
      },
    });
  }

  return finalAccepted;
}

type CreateLeadInput = {
  campaignId: string;
  supplierId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  zip?: string | null;
  source?: string | null;
  subId?: string | null;
  publisherId?: string | null;
  cost?: unknown;
  clickId?: string | null;
};

export async function createLeadFromPayload(body: CreateLeadInput) {
  const {
    campaignId,
    supplierId,
    firstName,
    lastName,
    email,
    phone,
    state,
    zip,
    source,
    subId,
    publisherId,
    cost,
    clickId,
  } = body;

  if (!campaignId) {
    throw new Error("campaignId is required");
  }

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      buyerLinks: {
        include: {
          buyer: true,
        },
        orderBy: {
          priority: "asc",
        },
      },
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  let supplier = null;
  if (supplierId) {
    supplier = await db.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new Error("Supplier not found");
    }
  }

  let matchedClick: {
    clickId: string;
    organizationId: string;
    trackingCampaignId: string | null;
    trackingLinkId: string | null;
    trafficSource: string | null;
    publisherId: string | null;
    subId: string | null;
  } | null = null;

  if (clickId) {
    const foundClick = await db.clickEvent.findUnique({
      where: { clickId },
      select: {
        clickId: true,
        organizationId: true,
        trackingCampaignId: true,
        trackingLinkId: true,
        trafficSource: true,
        publisherId: true,
        subId: true,
      },
    });

    if (foundClick && foundClick.organizationId === campaign.organizationId) {
      matchedClick = foundClick;
    }
  }

  const resolvedSource = source ?? matchedClick?.trafficSource ?? null;
  const resolvedSubId = subId ?? matchedClick?.subId ?? null;
  const resolvedPublisherId = publisherId ?? matchedClick?.publisherId ?? null;
  const resolvedTrackingCampaignId = matchedClick?.trackingCampaignId ?? null;
  const resolvedTrackingLinkId = matchedClick?.trackingLinkId ?? null;

  const activeBuyers = campaign.buyerLinks
    .map((link) => link.buyer)
    .filter((buyer) => buyer.status === "active");

  let assignedBuyerId: string | null = null;
  let routingStatus = "pending";
  let revenue: number | null = null;
  let selectedBuyer: (typeof activeBuyers)[number] | null = null;
  let pingAttempts: PingAttemptResult[] = [];

  if (campaign.routingMode === "ping_post" && activeBuyers.length > 0) {
    pingAttempts = await Promise.all(
      activeBuyers.map((buyer) =>
        pingBuyer(buyer, {
          zip,
          state,
          source: resolvedSource,
          subId: resolvedSubId,
          publisherId: resolvedPublisherId,
        })
      )
    );

    const acceptedBids = pingAttempts
      .filter((result) => result.status === "accepted" && result.bid !== null)
      .sort((a, b) => (b.bid ?? 0) - (a.bid ?? 0));

    if (acceptedBids.length > 0) {
      const winningAttempt = acceptedBids[0];
      selectedBuyer =
        activeBuyers.find((buyer) => buyer.id === winningAttempt.buyerId) || null;
      revenue = winningAttempt.bid;
    }
  }

  if (!selectedBuyer && activeBuyers.length > 0) {
    const existingLeadCount = await db.lead.count({
      where: { campaignId },
    });

    selectedBuyer = activeBuyers[existingLeadCount % activeBuyers.length];
    revenue = toNumber(selectedBuyer.pricePerLead);
  }

  if (selectedBuyer) {
    assignedBuyerId = selectedBuyer.id;
    routingStatus = "assigned";
  }

  const explicitCost = toNumber(cost);
  const supplierDefaultCost = toNumber(supplier?.defaultCost);
  const numericCost = explicitCost !== null ? explicitCost : supplierDefaultCost;

  const { profit, marginPct } = calculateFinancials(numericCost, revenue);

  const lead = await db.lead.create({
    data: {
      organizationId: campaign.organizationId,
      campaignId,
      assignedBuyerId,
      supplierId: supplier?.id ?? null,
      firstName,
      lastName,
      email,
      phone,
      state,
      zip,
      source: resolvedSource,
      subId: resolvedSubId,
      publisherId: resolvedPublisherId,
      cost: numericCost,
      profit,
      marginPct,
      routingStatus,
      clickId: matchedClick?.clickId ?? clickId ?? null,
      trackingLinkId: resolvedTrackingLinkId,
      trackingCampaignId: resolvedTrackingCampaignId,
    },
    include: {
      campaign: true,
      assignedBuyer: true,
      supplier: true,
    },
  });

  if (campaign.routingMode === "ping_post" && pingAttempts.length > 0) {
    await db.pingResult.createMany({
      data: pingAttempts.map((attempt) => ({
        leadId: lead.id,
        buyerId: attempt.buyerId,
        status: attempt.status,
        bid: attempt.bid,
        won: selectedBuyer?.id === attempt.buyerId,
        response: attempt.response,
        error: attempt.error,
      })),
    });
  }

  const postUrl =
    lead.assignedBuyer?.postUrl || lead.assignedBuyer?.webhookUrl;

  if (assignedBuyerId && postUrl) {
    await deliverLeadToBuyer({
      lead: {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        state: lead.state,
        zip: lead.zip,
        source: lead.source,
        subId: lead.subId,
        publisherId: lead.publisherId,
        cost: lead.cost,
        routingStatus: lead.routingStatus,
        createdAt: lead.createdAt,
        campaign: {
          id: lead.campaign.id,
          name: lead.campaign.name,
        },
        assignedBuyer: lead.assignedBuyer
          ? {
              id: lead.assignedBuyer.id,
              name: lead.assignedBuyer.name,
              webhookUrl: lead.assignedBuyer.webhookUrl,
              postUrl: lead.assignedBuyer.postUrl,
            }
          : null,
      },
      buyerId: assignedBuyerId,
      postUrl,
    });
  }

  const leadWithDetails = await db.lead.findUnique({
    where: { id: lead.id },
    include: {
      campaign: true,
      assignedBuyer: true,
      supplier: true,
      trackingCampaign: true,
      trackingLink: true,
      deliveries: {
        orderBy: { createdAt: "desc" },
      },
      pingResults: {
        orderBy: { createdAt: "desc" },
        include: {
          buyer: true,
        },
      },
    },
  });

  return leadWithDetails;
}