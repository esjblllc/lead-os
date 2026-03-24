import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const {
      name,
      companyName,
      contactName,
      email,
      webhookUrl,
      pingUrl,
      postUrl,
      timeoutMs,
      minBid,
      status,
      pricePerLead,
      dailyCap,
      acceptedStates,
      requiredFields,
      notes,
      acceptanceMode,
      acceptancePath,
      acceptanceValue,
      payoutPath,
    } = body;

    const buyer = await db.buyer.update({
      where: { id },
      data: {
        ...(typeof name !== "undefined" ? { name } : {}),
        ...(typeof companyName !== "undefined" ? { companyName } : {}),
        ...(typeof contactName !== "undefined" ? { contactName } : {}),
        ...(typeof email !== "undefined" ? { email } : {}),
        ...(typeof webhookUrl !== "undefined" ? { webhookUrl } : {}),
        ...(typeof pingUrl !== "undefined" ? { pingUrl } : {}),
        ...(typeof postUrl !== "undefined" ? { postUrl } : {}),
        ...(typeof timeoutMs !== "undefined"
          ? {
              timeoutMs:
                timeoutMs === null || timeoutMs === ""
                  ? null
                  : Number(timeoutMs),
            }
          : {}),
        ...(typeof minBid !== "undefined"
          ? {
              minBid:
                minBid === null || minBid === ""
                  ? null
                  : Number(minBid),
            }
          : {}),
        ...(typeof status !== "undefined" ? { status } : {}),
        ...(typeof pricePerLead !== "undefined"
          ? {
              pricePerLead:
                pricePerLead === null || pricePerLead === ""
                  ? null
                  : Number(pricePerLead),
            }
          : {}),
        ...(typeof dailyCap !== "undefined"
          ? {
              dailyCap:
                dailyCap === null || dailyCap === ""
                  ? null
                  : Number(dailyCap),
            }
          : {}),
        ...(typeof acceptedStates !== "undefined" ? { acceptedStates } : {}),
        ...(typeof requiredFields !== "undefined" ? { requiredFields } : {}),
        ...(typeof notes !== "undefined" ? { notes } : {}),
        ...(typeof acceptanceMode !== "undefined"
          ? { acceptanceMode: acceptanceMode || "standard" }
          : {}),
        ...(typeof acceptancePath !== "undefined"
          ? { acceptancePath: acceptancePath || null }
          : {}),
        ...(typeof acceptanceValue !== "undefined"
          ? { acceptanceValue: acceptanceValue || null }
          : {}),
        ...(typeof payoutPath !== "undefined"
          ? { payoutPath: payoutPath || null }
          : {}),
      },
    });

    return Response.json({ data: buyer });
  } catch (error) {
    console.error("Buyer PATCH error:", error);

    return Response.json(
      { error: "Failed to update buyer" },
      { status: 500 }
    );
  }
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const buyer = await db.buyer.findUnique({
      where: { id },
    });

    if (!buyer) {
      return Response.json(
        { error: "Buyer not found" },
        { status: 404 }
      );
    }

    return Response.json({ data: buyer });
  } catch (error) {
    console.error("Buyer GET by id error:", error);

    return Response.json(
      { error: "Failed to fetch buyer" },
      { status: 500 }
    );
  }
}