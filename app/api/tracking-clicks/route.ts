import { db } from "@/lib/db";
import { getRequestSessionUser, isPlatformAdmin } from "@/lib/request-session-user";

export async function GET(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized", data: [] }, { status: 401 });
    }

    const clicks = await db.clickEvent.findMany({
      where: isPlatformAdmin(sessionUser)
        ? {}
        : {
            organizationId: sessionUser.organizationId,
          },
      orderBy: { createdAt: "desc" },
      take: 250,
      include: {
        trackingCampaign: true,
        trackingLink: true,
      },
    });

    console.log("tracking-clicks api", {
      userOrg: sessionUser.organizationId,
      isPlatformAdmin: isPlatformAdmin(sessionUser),
      count: clicks.length,
    });

    return Response.json({ data: clicks });
  } catch (error) {
    console.error("Tracking clicks GET error:", error);
    return Response.json(
      { error: "Failed to fetch clicks", data: [] },
      { status: 500 }
    );
  }
}