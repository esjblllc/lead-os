import { db } from "@/lib/db";
import { getRequestSessionUser, isPlatformAdmin } from "@/lib/request-session-user";

export async function GET(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await db.campaign.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : { organizationId: sessionUser.organizationId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ data: campaigns });
  } catch (error) {
    console.error("Campaigns GET error:", error);

    return Response.json(
      { error: "Failed to fetch campaigns" },
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

    const body = await req.json();
    const { name, slug, vertical, routingMode, status } = body;

    if (!name || !slug || !vertical) {
      return Response.json(
        { error: "name, slug, and vertical are required" },
        { status: 400 }
      );
    }

    const campaign = await db.campaign.create({
      data: {
        organizationId: sessionUser.organizationId,
        name,
        slug,
        vertical,
        routingMode: routingMode || "direct_post",
        status: status || "active",
      },
    });

    return Response.json({ data: campaign }, { status: 201 });
  } catch (error) {
    console.error("Campaigns POST error:", error);

    return Response.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}