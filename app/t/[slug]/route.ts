import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "node:crypto";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

function buildClickId() {
  return crypto.randomUUID();
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return null;
}

function getParam(
  params: URLSearchParams,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = params.get(key);
    if (value && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}

function mergeDestinationUrl(
  baseUrl: string,
  params: URLSearchParams,
  clickId: string
) {
  const url = new URL(baseUrl);

  params.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  url.searchParams.set("click_id", clickId);

  return url.toString();
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;

    const trackingLink = await db.trackingLink.findUnique({
      where: { slug },
      include: {
        trackingCampaign: true,
      },
    });

    if (!trackingLink || trackingLink.status !== "active") {
      return new Response("Tracking link not found", { status: 404 });
    }

    const baseDestinationUrl =
      trackingLink.destinationUrl || trackingLink.trackingCampaign?.destinationUrl;

    if (!baseDestinationUrl) {
      return new Response("Tracking destination is not configured", {
        status: 500,
      });
    }

    const requestUrl = new URL(request.url);
    const clickId = buildClickId();

    const trafficSource =
      getParam(requestUrl.searchParams, ["source", "trafficSource"]) ||
      trackingLink.trafficSource ||
      null;

    const publisherId =
      getParam(requestUrl.searchParams, ["publisherId", "publisher_id"]) ||
      trackingLink.publisherId ||
      null;

    const subId =
      getParam(requestUrl.searchParams, ["subId", "sub_id", "sub1"]) ||
      trackingLink.subId ||
      null;

    const subId2 =
      getParam(requestUrl.searchParams, ["subId2", "sub_id2", "sub2"]) ||
      trackingLink.subId2 ||
      null;

    const subId3 =
      getParam(requestUrl.searchParams, ["subId3", "sub_id3", "sub3"]) ||
      trackingLink.subId3 ||
      null;

    const finalDestinationUrl = mergeDestinationUrl(
      baseDestinationUrl,
      requestUrl.searchParams,
      clickId
    );

    try {
      const createdClick = await db.clickEvent.create({
        data: {
          clickId,
          organizationId: trackingLink.organizationId,
          trackingCampaignId: trackingLink.trackingCampaignId,
          trackingLinkId: trackingLink.id,
          trafficSource,
          publisherId,
          subId,
          subId2,
          subId3,
          cost:
            trackingLink.costPerClick !== null &&
            typeof trackingLink.costPerClick !== "undefined"
              ? trackingLink.costPerClick
              : null,
          destinationUrl: finalDestinationUrl,
          ipAddress: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
          referer: request.headers.get("referer"),
          queryString: requestUrl.search || null,
        },
      });

      console.log("Tracking click created:", {
        id: createdClick.id,
        clickId: createdClick.clickId,
        slug,
      });
    } catch (clickError) {
      console.error("Failed to create click event:", {
        slug,
        trackingLinkId: trackingLink.id,
        trackingCampaignId: trackingLink.trackingCampaignId,
        organizationId: trackingLink.organizationId,
        error: clickError,
      });
    }

    return NextResponse.redirect(finalDestinationUrl, { status: 302 });
  } catch (error) {
    console.error("Tracking redirect route failed:", error);
    return new Response("Tracking redirect failed", { status: 500 });
  }
}