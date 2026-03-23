import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const delivery = await db.delivery.findUnique({
      where: { id },
      include: {
        lead: {
          include: {
            campaign: true,
            assignedBuyer: true,
          },
        },
        buyer: true,
      },
    });

    if (!delivery) {
      return Response.json(
        { error: "Delivery not found" },
        { status: 404 }
      );
    }

    if (!delivery.buyer.webhookUrl) {
      return Response.json(
        { error: "Buyer has no webhookUrl" },
        { status: 400 }
      );
    }

    const nextAttempt = delivery.attemptNumber + 1;

    try {
      const res = await fetch(delivery.buyer.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: delivery.lead.id,
          firstName: delivery.lead.firstName,
          lastName: delivery.lead.lastName,
          email: delivery.lead.email,
          phone: delivery.lead.phone,
          state: delivery.lead.state,
          zip: delivery.lead.zip,
          campaignId: delivery.lead.campaign.id,
          campaignName: delivery.lead.campaign.name,
          buyerId: delivery.buyer.id,
          buyerName: delivery.buyer.name,
          routingStatus: delivery.lead.routingStatus,
          createdAt: delivery.lead.createdAt,
          attemptNumber: nextAttempt,
          retryOfDeliveryId: delivery.id,
        }),
      });

      const text = await res.text();

      const retryDelivery = await db.delivery.create({
        data: {
          leadId: delivery.leadId,
          buyerId: delivery.buyerId,
          status: res.ok ? "success" : "failed",
          response: text,
          statusCode: res.status,
          attemptNumber: nextAttempt,
        },
      });

      return Response.json({ data: retryDelivery });
    } catch (err: any) {
      const retryDelivery = await db.delivery.create({
        data: {
          leadId: delivery.leadId,
          buyerId: delivery.buyerId,
          status: "failed",
          response: err?.message ?? "Unknown retry error",
          attemptNumber: nextAttempt,
        },
      });

      return Response.json({ data: retryDelivery });
    }
  } catch (error) {
    console.error("Delivery retry error:", error);

    return Response.json(
      { error: "Failed to retry delivery" },
      { status: 500 }
    );
  }
}