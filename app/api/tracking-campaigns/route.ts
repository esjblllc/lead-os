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

    const campaigns = await db.trackingCampaign.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : { organizationId: sessionUser.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        organization: true,
        _count: {
          select: {
            links: true,
            clicks: true,
          },
        },
      },
    });

    const organizations = await db.organization.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : { id: sessionUser.organizationId },
      orderBy: { name: "asc" },
    });

    return Response.json({
      data: campaigns,
      organizations,
    });
  } catch (error) {
    console.error("Tracking campaigns GET error:", error);
    return Response.json(
      { error: "Failed to fetch tracking campaigns" },
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
    const { name, slug, destinationUrl, status, notes, organizationId } = body;

    if (!name || !destinationUrl) {
      return Response.json(
        { error: "Name and destinationUrl are required" },
        { status: 400 }
      );
    }

    const finalOrganizationId = isPlatformAdmin(sessionUser)
      ? organizationId || sessionUser.organizationId
      : sessionUser.organizationId;

    const generatedSlug = slugify(slug || name);

    if (!generatedSlug) {
      return Response.json(
        { error: "Unable to generate campaign slug" },
        { status: 400 }
      );
    }

    const existing = await db.trackingCampaign.findUnique({
      where: { slug: generatedSlug },
    });

    if (existing) {
      return Response.json(
        { error: "A tracking campaign with that slug already exists" },
        { status: 400 }
      );
    }

    const campaign = await db.trackingCampaign.create({
      data: {
        organizationId: finalOrganizationId,
        name,
        slug: generatedSlug,
        destinationUrl,
        status: status || "active",
        notes: notes || null,
      },
      include: {
        organization: true,
        _count: {
          select: {
            links: true,
            clicks: true,
          },
        },
      },
    });

    return Response.json({ data: campaign }, { status: 201 });
  } catch (error) {
    console.error("Tracking campaigns POST error:", error);
    return Response.json(
      { error: "Failed to create tracking campaign" },
      { status: 500 }
    );
  }
}