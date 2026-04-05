import { db } from "@/lib/db";
import {
  getRequestSessionUser,
  isPlatformAdmin,
} from "@/lib/request-session-user";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== "platform_admin" && sessionUser.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const existing = await db.trackingLink.findUnique({
      where: { id },
    });

    if (!existing) {
      return Response.json({ error: "Tracking link not found" }, { status: 404 });
    }

    if (
      !isPlatformAdmin(sessionUser) &&
      existing.organizationId !== sessionUser.organizationId
    ) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await db.trackingLink.update({
      where: { id },
      data: {
        publisherPostbackEnabled:
          typeof body.publisherPostbackEnabled === "boolean"
            ? body.publisherPostbackEnabled
            : existing.publisherPostbackEnabled,
        publisherPostbackUrl:
          typeof body.publisherPostbackUrl === "string"
            ? body.publisherPostbackUrl || null
            : existing.publisherPostbackUrl,
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

    return Response.json({ data: updated });
  } catch (error) {
    console.error("Tracking link PATCH error:", error);
    return Response.json(
      { error: "Failed to update tracking link" },
      { status: 500 }
    );
  }
}
