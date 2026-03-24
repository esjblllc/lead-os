import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { parseBuyerResponse } from "@/lib/buyer-response";

type BuyerForRouting = {
  id: string;
  name: string;
  pingUrl: string | null;
  postUrl: string | null;
  webhookUrl: string | null;
  timeoutMs: number | null;
  minBid: any;
  pricePerLead: any;
  acceptanceMode: string;
  acceptancePath: string | null;
  acceptanceValue: string | null;
  payoutPath: string | null;
  acceptedStates?: string | null;
  requiredFields?: string | null;
};

type EligibleBuyerLink = {
  priority: number;
  buyer: BuyerForRouting;
};

function toNumber(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") {
    return 0;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function calculateMarginPct(revenue: number, cost: number) {
  if (revenue <= 0) return 0;
  return ((revenue - cost) / revenue) * 100;
}

function stringifyResponseBody(value: unknown) {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getRequestOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

function toAbsoluteUrl(url: string, req: NextRequest) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${getRequestOrigin(req)}${url}`;
  }

  return `${getRequestOrigin(req)}/${url}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readResponse(response: Response) {
  const text = await response.text();

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    text,
    json,
  };
}

function getLegacyAccepted(responseJson: any) {
  return (
    responseJson?.accepted === true ||
    responseJson?.accept === true ||
    responseJson?.success === true ||
    responseJson?.status === "accepted" ||
    responseJson?.result === "accepted"
  );
}

function getLegacyBid(responseJson: any) {
  const raw =
    responseJson?.bid ??
    responseJson?.price ??
    responseJson?.payout ??
    responseJson?.amount ??
    null;

  if (raw === null || typeof raw === "undefined") return null;

  const numeric = Number(raw);
  return Number.isNaN(numeric) ? null : numeric;
}

function buildPingPayload(body: any, leadId: string, campaign: any) {
  return {
    leadId,
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignSlug: campaign.slug,
    firstName: body.firstName ?? null,
    lastName: body.lastName ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    state: body.state ?? null,
    zip: body.zip ?? null,
    source: body.source ?? null,
    subId: body.subId ?? null,
    publisherId: body.publisherId ?? null,
  };
}

function buildPostPayload(
  body: any,
  leadId: string,
  campaign: any,
  buyer: BuyerForRouting
) {
  return {
    leadId,
    firstName: body.firstName ?? null,
    lastName: body.lastName ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    state: body.state ?? null,
    zip: body.zip ?? null,
    source: body.source ?? null,
    subId: body.subId ?? null,
    publisherId: body.publisherId ?? null,
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignSlug: campaign.slug,
    buyerId: buyer.id,
    buyerName: buyer.name,
    routingStatus: "assigned",
    createdAt: new Date().toISOString(),
  };
}

function parseCsvList(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function buyerAllowsLeadState(
  buyer: BuyerForRouting,
  state: string | null | undefined
) {
  const allowedStates = parseCsvList(buyer.acceptedStates);
  if (allowedStates.length === 0) return true;
  if (!state) return false;
  return allowedStates.includes(String(state).toUpperCase());
}

function buyerHasRequiredFields(buyer: BuyerForRouting, body: any) {
  const requiredFields = parseCsvList(buyer.requiredFields);
  if (requiredFields.length === 0) return true;

  return requiredFields.every((field) => {
    const key = field.charAt(0).toLowerCase() + field.slice(1).toLowerCase();
    const value = body[key];
    return value !== null && typeof value !== "undefined" && value !== "";
  });
}

async function getBuyerPerformanceScores(
  buyerIds: string[],
  fallbackBuyers: BuyerForRouting[]
) {
  if (buyerIds.length === 0) {
    return new Map<string, number>();
  }

  const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentDeliveries = await db.delivery.findMany({
    where: {
      buyerId: { in: buyerIds },
      createdAt: { gte: windowStart },
    },
    include: {
      lead: {
        select: {
          cost: true,
          profit: true,
        },
      },
    },
  });

  const grouped = new Map<
    string,
    {
      total: number;
      success: number;
      failed: number;
      realizedRevenueTotal: number;
      realizedRevenueCount: number;
    }
  >();

  for (const buyerId of buyerIds) {
    grouped.set(buyerId, {
      total: 0,
      success: 0,
      failed: 0,
      realizedRevenueTotal: 0,
      realizedRevenueCount: 0,
    });
  }

  for (const delivery of recentDeliveries) {
    const stats = grouped.get(delivery.buyerId);
    if (!stats) continue;

    stats.total += 1;

    if (delivery.status === "success") {
      stats.success += 1;

      const cost = toNumber(delivery.lead?.cost);
      const profit = toNumber(delivery.lead?.profit);
      const realizedRevenue = cost + profit;

      if (realizedRevenue > 0) {
        stats.realizedRevenueTotal += realizedRevenue;
        stats.realizedRevenueCount += 1;
      }
    } else {
      stats.failed += 1;
    }
  }

  const scoreMap = new Map<string, number>();

  for (const buyer of fallbackBuyers) {
    const stats = grouped.get(buyer.id);

    if (!stats || stats.total === 0) {
      scoreMap.set(buyer.id, toNumber(buyer.pricePerLead));
      continue;
    }

    const acceptanceRate = stats.success / stats.total;
    const failureRate = stats.failed / stats.total;

    const avgRevenue =
      stats.realizedRevenueCount > 0
        ? stats.realizedRevenueTotal / stats.realizedRevenueCount
        : toNumber(buyer.pricePerLead);

    const score = avgRevenue * acceptanceRate - failureRate * 5;

    scoreMap.set(buyer.id, score);
  }

  return scoreMap;
}

async function handlePing(
  req: NextRequest,
  buyer: BuyerForRouting,
  leadId: string,
  body: any,
  campaign: any
) {
  if (!buyer.pingUrl) {
    return {
      accepted: false,
      bid: null as number | null,
      status: "error",
      responseText: "Missing pingUrl",
      error: "Missing pingUrl",
    };
  }

  const timeoutMs = buyer.timeoutMs ?? 1500;
  const absoluteUrl = toAbsoluteUrl(buyer.pingUrl, req);

  try {
    const response = await fetchWithTimeout(
      absoluteUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPingPayload(body, leadId, campaign)),
      },
      timeoutMs
    );

    const { text, json } = await readResponse(response);

    const parsed = parseBuyerResponse(buyer, json);
    const accepted = parsed.accepted || getLegacyAccepted(json);
    const bid = parsed.payout ?? getLegacyBid(json);

    const minBid =
      buyer.minBid !== null && typeof buyer.minBid !== "undefined"
        ? Number(buyer.minBid)
        : null;

    const meetsMinBid =
      minBid === null || bid === null ? true : Number(bid) >= minBid;

    if (!response.ok) {
      return {
        accepted: false,
        bid,
        status: "error",
        responseText: text,
        error: `HTTP ${response.status}`,
      };
    }

    if (!json && text) {
      return {
        accepted: false,
        bid,
        status: "invalid_response",
        responseText: text,
        error: "Ping response was not valid JSON",
      };
    }

    if (accepted && meetsMinBid) {
      return {
        accepted: true,
        bid,
        status: "accepted",
        responseText: text || stringifyResponseBody(json),
        error: null,
      };
    }

    return {
      accepted: false,
      bid,
      status: "rejected",
      responseText: text || stringifyResponseBody(json),
      error: !meetsMinBid ? "Bid below minBid" : null,
    };
  } catch (error: any) {
    const timeoutLike =
      error?.name === "AbortError" ||
      String(error?.message || "")
        .toLowerCase()
        .includes("aborted");

    return {
      accepted: false,
      bid: null,
      status: timeoutLike ? "timeout" : "error",
      responseText: "",
      error: timeoutLike ? "Ping timed out" : error?.message || "Ping failed",
    };
  }
}

async function handlePost(
  req: NextRequest,
  buyer: BuyerForRouting,
  leadId: string,
  body: any,
  campaign: any
) {
  const destination = buyer.postUrl || buyer.webhookUrl;

  if (!destination) {
    return {
      accepted: false,
      payout: null as number | null,
      status: "failed",
      statusCode: null as number | null,
      responseText: "Missing postUrl/webhookUrl",
    };
  }

  const timeoutMs = buyer.timeoutMs ?? 1500;
  const absoluteUrl = toAbsoluteUrl(destination, req);

  try {
    const response = await fetchWithTimeout(
      absoluteUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPostPayload(body, leadId, campaign, buyer)),
      },
      timeoutMs
    );

    const { text, json } = await readResponse(response);

    const parsed = parseBuyerResponse(buyer, json);
    const accepted = parsed.accepted || getLegacyAccepted(json);
    const payout =
      parsed.payout ??
      (json?.payout !== undefined ? Number(json.payout) : null) ??
      (json?.price !== undefined ? Number(json.price) : null) ??
      (json?.amount !== undefined ? Number(json.amount) : null);

    if (!response.ok) {
      return {
        accepted: false,
        payout,
        status: "failed",
        statusCode: response.status,
        responseText: text || stringifyResponseBody(json),
      };
    }

    if (!json && text) {
      return {
        accepted: false,
        payout,
        status: "failed",
        statusCode: response.status,
        responseText: text,
      };
    }

    return {
      accepted,
      payout:
        payout !== null && !Number.isNaN(Number(payout)) ? Number(payout) : null,
      status: accepted ? "success" : "failed",
      statusCode: response.status,
      responseText: text || stringifyResponseBody(json),
    };
  } catch (error: any) {
    const timeoutLike =
      error?.name === "AbortError" ||
      String(error?.message || "")
        .toLowerCase()
        .includes("aborted");

    return {
      accepted: false,
      payout: null,
      status: "failed",
      statusCode: null,
      responseText: timeoutLike
        ? "Post timed out"
        : error?.message || "Post failed",
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return Response.json(
        { error: "Missing x-api-key header" },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (!body.campaignSlug) {
      return Response.json(
        { error: "campaignSlug is required" },
        { status: 400 }
      );
    }

    const supplier = await db.supplier.findFirst({
      where: {
        apiKey,
        status: "active",
      },
    });

    if (!supplier) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    const campaign = await db.campaign.findFirst({
      where: {
        slug: body.campaignSlug,
        status: "active",
      },
    });

    if (!campaign) {
      return Response.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.organizationId !== supplier.organizationId) {
      return Response.json(
        { error: "Supplier not authorized for this campaign" },
        { status: 403 }
      );
    }

    const lead = await db.lead.create({
      data: {
        organizationId: campaign.organizationId,
        campaignId: campaign.id,
        supplierId: supplier.id,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        email: body.email || null,
        phone: body.phone || null,
        state: body.state || null,
        zip: body.zip || null,
        source: body.source || supplier.trafficSource || null,
        subId: body.subId || null,
        publisherId: body.publisherId || null,
        cost:
          typeof body.cost !== "undefined" && body.cost !== null
            ? Number(body.cost)
            : supplier.defaultCost
              ? Number(supplier.defaultCost)
              : null,
        routingStatus: "pending",
      },
    });

    const linkedBuyers = await db.campaignBuyer.findMany({
      where: {
        campaignId: campaign.id,
        buyer: {
          status: "active",
        },
      },
      orderBy: {
        priority: "asc",
      },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            pingUrl: true,
            postUrl: true,
            webhookUrl: true,
            timeoutMs: true,
            minBid: true,
            pricePerLead: true,
            acceptanceMode: true,
            acceptancePath: true,
            acceptanceValue: true,
            payoutPath: true,
            acceptedStates: true,
            requiredFields: true,
          },
        },
      },
    });

    if (linkedBuyers.length === 0) {
      return Response.json({
        success: true,
        leadId: lead.id,
        routingStatus: "pending",
        message: "No active buyers linked to campaign",
      });
    }

    const eligibleBuyerLinks: EligibleBuyerLink[] = linkedBuyers.filter((link) => {
      const buyer = link.buyer;

      return (
        buyerAllowsLeadState(buyer, body.state) &&
        buyerHasRequiredFields(buyer, body)
      );
    });

    if (eligibleBuyerLinks.length === 0) {
      return Response.json({
        success: true,
        leadId: lead.id,
        routingStatus: "pending",
        message: "No eligible buyers matched lead requirements",
      });
    }

    const leadCost = toNumber(lead.cost);

    if (campaign.routingMode === "ping_post") {
      const acceptedPings: {
        buyer: BuyerForRouting;
        bid: number;
        priority: number;
      }[] = [];

      for (const link of eligibleBuyerLinks) {
        const buyer = link.buyer;

        const pingResult = await handlePing(req, buyer, lead.id, body, campaign);

        const createdPing = await db.pingResult.create({
          data: {
            leadId: lead.id,
            buyerId: buyer.id,
            status: pingResult.status,
            bid: pingResult.bid,
            won: false,
            response: pingResult.responseText || null,
            error: pingResult.error || null,
          },
        });

        if (pingResult.accepted) {
          acceptedPings.push({
            buyer,
            bid: pingResult.bid ?? 0,
            priority: link.priority,
          });

          await db.pingResult.update({
            where: { id: createdPing.id },
            data: { won: false },
          });
        }
      }

      if (acceptedPings.length === 0) {
        await db.lead.update({
          where: { id: lead.id },
          data: {
            routingStatus: "pending",
            assignedBuyerId: null,
            profit: null,
            marginPct: null,
          },
        });

        return Response.json({
          success: true,
          leadId: lead.id,
          routingStatus: "pending",
          message: "No buyers accepted the ping",
        });
      }

      const buyerPerformanceScores = await getBuyerPerformanceScores(
        acceptedPings.map((item) => item.buyer.id),
        acceptedPings.map((item) => item.buyer)
      );

      const orderedCandidates = [...acceptedPings].sort((a, b) => {
        if (b.bid !== a.bid) return b.bid - a.bid;

        const scoreA = buyerPerformanceScores.get(a.buyer.id) ?? 0;
        const scoreB = buyerPerformanceScores.get(b.buyer.id) ?? 0;

        if (scoreB !== scoreA) return scoreB - scoreA;

        return a.priority - b.priority;
      });

      for (const candidate of orderedCandidates) {
        await db.pingResult.updateMany({
          where: {
            leadId: lead.id,
            buyerId: candidate.buyer.id,
          },
          data: {
            won: true,
          },
        });

        const postResult = await handlePost(
          req,
          candidate.buyer,
          lead.id,
          body,
          campaign
        );

        await db.delivery.create({
          data: {
            leadId: lead.id,
            buyerId: candidate.buyer.id,
            status: postResult.status,
            response: postResult.responseText || null,
            statusCode: postResult.statusCode,
            attemptNumber: 1,
          },
        });

        if (postResult.accepted) {
          const revenue =
            postResult.payout !== null
              ? Number(postResult.payout)
              : toNumber(candidate.buyer.pricePerLead);

          const profit = revenue - leadCost;
          const marginPct = calculateMarginPct(revenue, leadCost);

          await db.lead.update({
            where: { id: lead.id },
            data: {
              assignedBuyerId: candidate.buyer.id,
              routingStatus: "assigned",
              profit,
              marginPct,
            },
          });

          return Response.json({
            success: true,
            leadId: lead.id,
            routingStatus: "assigned",
            buyerId: candidate.buyer.id,
            buyerName: candidate.buyer.name,
            payout: revenue,
          });
        }
      }

      await db.lead.update({
        where: { id: lead.id },
        data: {
          assignedBuyerId: null,
          routingStatus: "pending",
          profit: null,
          marginPct: null,
        },
      });

      return Response.json({
        success: true,
        leadId: lead.id,
        routingStatus: "pending",
        message: "Ping accepted but all buyer posts failed",
      });
    }

    const directBuyers = eligibleBuyerLinks.map((link) => link.buyer);
    const directBuyerScores = await getBuyerPerformanceScores(
      directBuyers.map((buyer) => buyer.id),
      directBuyers
    );

    const rankedDirectLinks = [...eligibleBuyerLinks].sort((a, b) => {
      const scoreA = directBuyerScores.get(a.buyer.id) ?? 0;
      const scoreB = directBuyerScores.get(b.buyer.id) ?? 0;

      if (scoreB !== scoreA) return scoreB - scoreA;

      return a.priority - b.priority;
    });

    for (const link of rankedDirectLinks) {
      const buyer = link.buyer;

      const postResult = await handlePost(req, buyer, lead.id, body, campaign);

      await db.delivery.create({
        data: {
          leadId: lead.id,
          buyerId: buyer.id,
          status: postResult.status,
          response: postResult.responseText || null,
          statusCode: postResult.statusCode,
          attemptNumber: 1,
        },
      });

      if (postResult.accepted) {
        const revenue =
          postResult.payout !== null
            ? Number(postResult.payout)
            : toNumber(buyer.pricePerLead);

        const profit = revenue - leadCost;
        const marginPct = calculateMarginPct(revenue, leadCost);

        await db.lead.update({
          where: { id: lead.id },
          data: {
            assignedBuyerId: buyer.id,
            routingStatus: "assigned",
            profit,
            marginPct,
          },
        });

        return Response.json({
          success: true,
          leadId: lead.id,
          routingStatus: "assigned",
          buyerId: buyer.id,
          buyerName: buyer.name,
          payout: revenue,
        });
      }
    }

    await db.lead.update({
      where: { id: lead.id },
      data: {
        assignedBuyerId: null,
        routingStatus: "pending",
        profit: null,
        marginPct: null,
      },
    });

    return Response.json({
      success: true,
      leadId: lead.id,
      routingStatus: "pending",
      message: "No buyer accepted the lead",
    });
  } catch (error: any) {
    console.error("Inbound lead route error:", error);

    return Response.json(
      {
        error: error?.message || "Failed to process inbound lead",
      },
      { status: 500 }
    );
  }
}