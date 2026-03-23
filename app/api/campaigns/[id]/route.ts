import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      buyerLinks: {
        include: {
          buyer: true,
        },
      },
      leads: true,
    },
  });

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  return Response.json({ data: campaign });
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const { name, slug, vertical, routingMode, status } = body;

    const existingCampaign = await db.campaign.findUnique({
      where: { id },
    });

    if (!existingCampaign) {
      return Response.json({ error: "Campaign not found" }, { status: 404 });
    }

    const updatedCampaign = await db.campaign.update({
      where: { id },
      data: {
        ...(typeof name !== "undefined" ? { name } : {}),
        ...(typeof slug !== "undefined" ? { slug } : {}),
        ...(typeof vertical !== "undefined" ? { vertical } : {}),
        ...(typeof routingMode !== "undefined" ? { routingMode } : {}),
        ...(typeof status !== "undefined" ? { status } : {}),
      },
    });

    return Response.json({ data: updatedCampaign });
  } catch (error) {
    console.error("Campaign PATCH error:", error);

    return Response.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}