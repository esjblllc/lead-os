import { db } from "@/lib/db";
import { getRequestSessionUser, isPlatformAdmin } from "@/lib/request-session-user";
import { normalizeInboundFieldList } from "@/lib/inbound-spec";

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

    const { id } = await context.params;
    const body = await req.json();

    const existingCampaign = await db.campaign.findUnique({
      where: { id },
    });

    if (!existingCampaign) {
      return Response.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (
      !isPlatformAdmin(sessionUser) &&
      existingCampaign.organizationId !== sessionUser.organizationId
    ) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const campaign = await db.campaign.update({
      where: { id },
      data: {
        ...(typeof body.name !== "undefined" ? { name: body.name } : {}),
        ...(typeof body.slug !== "undefined" ? { slug: body.slug } : {}),
        ...(typeof body.vertical !== "undefined" ? { vertical: body.vertical } : {}),
        ...(typeof body.routingMode !== "undefined"
          ? { routingMode: body.routingMode }
          : {}),
        ...(typeof body.status !== "undefined" ? { status: body.status } : {}),
        ...(typeof body.inboundRequiredFields !== "undefined"
          ? {
              inboundRequiredFields: normalizeInboundFieldList(
                body.inboundRequiredFields
              ),
            }
          : {}),
        ...(typeof body.inboundOptionalFields !== "undefined"
          ? {
              inboundOptionalFields: normalizeInboundFieldList(
                body.inboundOptionalFields
              ),
            }
          : {}),
        ...(typeof body.publisherSpecNotes !== "undefined"
          ? { publisherSpecNotes: body.publisherSpecNotes || null }
          : {}),
      },
    });

    return Response.json({ data: campaign });
  } catch (error) {
    console.error("Campaign PATCH error:", error);

    return Response.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}
