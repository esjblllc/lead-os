import { db } from "@/lib/db";
import { redirect } from "next/navigation";
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
    return new Response("Tracking destination is not configured", { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const clickId = buildClickId();

  const trafficSource =
    requestUrl.searchParams.get("source") ||
    requestUrl.searchParams.get("trafficSource") ||
    trackingLink.trafficSource ||
    null;

  const publisherId =
    requestUrl.searchParams.get("publisherId") ||
    requestUrl.searchParams.get("publisher_id") ||
    trackingLink.publisherId ||
    null;

  const subId =
    requestUrl.searchParams.get("subId") ||
    requestUrl.searchParams.get("sub_id") ||
    requestUrl.searchParams.get("sub1") ||
    trackingLink.subId ||
    null;

  const subId2 =
    requestUrl.searchParams.get("subId2") ||
    requestUrl.searchParams.get("sub_id2") ||
    requestUrl.searchParams.get("sub2") ||
    trackingLink.subId2 ||
    null;

  const subId3 =
    requestUrl.searchParams.get("subId3") ||
    requestUrl.searchParams.get("sub_id3") ||
    requestUrl.searchParams.get("sub3") ||
    trackingLink.subId3 ||
    null;

  const finalDestinationUrl = mergeDestinationUrl(
    baseDestinationUrl,
    requestUrl.searchParams,
    clickId
  );

  await db.clickEvent.create({
    data: {
      organizationId: trackingLink.organizationId,
      trackingCampaignId: trackingLink.trackingCampaignId,
      trackingLinkId: trackingLink.id,
      clickId,
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

  redirect(finalDestinationUrl);
}