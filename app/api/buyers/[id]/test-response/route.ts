import { db } from "@/lib/db";
import { parseBuyerResponse } from "@/lib/buyer-response";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const buyer = await db.buyer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        acceptanceMode: true,
        acceptancePath: true,
        acceptanceValue: true,
        payoutPath: true,
        pricePerLead: true,
      },
    });

    if (!buyer) {
      return Response.json({ error: "Buyer not found" }, { status: 404 });
    }

    const responseBody = body?.responseBody;

    const parsed = parseBuyerResponse(buyer, responseBody);

    return Response.json({
      data: {
        buyerId: buyer.id,
        buyerName: buyer.name,
        acceptanceMode: buyer.acceptanceMode,
        acceptancePath: buyer.acceptancePath,
        acceptanceValue: buyer.acceptanceValue,
        payoutPath: buyer.payoutPath,
        accepted: parsed.accepted,
        payout: parsed.payout,
      },
    });
  } catch (error) {
    console.error("Buyer response test error:", error);

    return Response.json(
      { error: "Failed to test buyer response" },
      { status: 500 }
    );
  }
}