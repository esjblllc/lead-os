import { db } from "@/lib/db";
import { getRequestSessionUser, isPlatformAdmin } from "@/lib/request-session-user";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const links = await db.trackingLink.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : { organizationId: sessionUser.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        organization: true,
        trackingCampaign: true,
        _count: {
          select: {
            clicks: true,
            leads: true,
          },
        },
      },
    });

    const campaigns = await db.trackingCampaign.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : { organizationId: sessionUser.organizationId },
      orderBy: { name: "asc" },
    });

    const organizations = await db.organization.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : { id: sessionUser.organizationId },
      orderBy: { name: "asc" },
    });

    return Response.json({
      data: links,
      campaigns,
      organizations,
    });
  } catch (error) {
    console.error("Tracking links GET error:", error);
    return Response.json(
      { error: "Failed to fetch tracking links" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== "platform_admin" && sessionUser.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      slug,
      trackingCampaignId,
      trafficSource,
      publisherId,
      subId,
      subId2,
      subId3,
      costModel,
      costPerClick,
      destinationUrl,
      status,
      organizationId,
    } = body;

    if (!name || !trackingCampaignId) {
      return Response.json(
        { error: "Name and trackingCampaignId are required" },
        { status: 400 }
      );
    }

    const campaign = await db.trackingCampaign.findUnique({
      where: { id: trackingCampaignId },
    });

    if (!campaign) {
      return Response.json(
        { error: "Tracking campaign not found" },
        { status: 404 }
      );
    }

    if (
      !isPlatformAdmin(sessionUser) &&
      campaign.organizationId !== sessionUser.organizationId
    ) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const finalOrganizationId = isPlatformAdmin(sessionUser)
      ? organizationId || campaign.organizationId
      : sessionUser.organizationId;

    const generatedSlug = slugify(slug || name);

    if (!generatedSlug) {
      return Response.json(
        { error: "Unable to generate link slug" },
        { status: 400 }
      );
    }

    const existing = await db.trackingLink.findUnique({
      where: { slug: generatedSlug },
    });

    if (existing) {
      return Response.json(
        { error: "A tracking link with that slug already exists" },
        { status: 400 }
      );
    }

    const link = await db.trackingLink.create({
      data: {
        organizationId: finalOrganizationId,
        trackingCampaignId,
        name,
        slug: generatedSlug,
        trafficSource: trafficSource || null,
        publisherId: publisherId || null,
        subId: subId || null,
        subId2: subId2 || null,
        subId3: subId3 || null,
        costModel: costModel || "cpc",
        costPerClick:
          costPerClick !== "" && costPerClick !== null && typeof costPerClick !== "undefined"
            ? Number(costPerClick)
            : null,
        destinationUrl: destinationUrl || null,
        status: status || "active",
      },
      include: {
        organization: true,
        trackingCampaign: true,
        _count: {
          select: {
            clicks: true,
            leads: true,
          },
        },
      },
    });

    return Response.json({ data: link }, { status: 201 });
  } catch (error) {
    console.error("Tracking links POST error:", error);
    return Response.json(
      { error: "Failed to create tracking link" },
      { status: 500 }
    );
  }
}