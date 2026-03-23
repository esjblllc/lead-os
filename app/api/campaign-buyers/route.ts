import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { campaignId, buyerId, priority } = body;

    if (!campaignId || !buyerId) {
      return Response.json(
        { error: "campaignId and buyerId are required" },
        { status: 400 }
      );
    }

    const existing = await db.campaignBuyer.findFirst({
      where: {
        campaignId,
        buyerId,
      },
    });

    if (existing) {
      return Response.json(
        { error: "Buyer is already linked to this campaign" },
        { status: 400 }
      );
    }

    const link = await db.campaignBuyer.create({
      data: {
        campaignId,
        buyerId,
        priority: typeof priority === "number" ? priority : 1,
      },
      include: {
        campaign: true,
        buyer: true,
      },
    });

    return Response.json({ data: link }, { status: 201 });
  } catch (error) {
    console.error("CampaignBuyer POST error:", error);

    return Response.json(
      { error: "Failed to create campaign-buyer link" },
      { status: 500 }
    );
  }
}