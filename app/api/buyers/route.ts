import { db } from "@/lib/db";
import { getOrCreateDefaultOrganization } from "@/lib/default-org";

export async function GET() {
  try {
    const buyers = await db.buyer.findMany({
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ data: buyers });
  } catch (error) {
    console.error("Buyer GET error:", error);

    return Response.json(
      { error: "Failed to fetch buyers" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      organizationId,
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
      acceptedStates,
      requiredFields,
      notes,
      acceptanceMode,
      acceptancePath,
      acceptanceValue,
      payoutPath,
    } = body;

    if (!name) {
      return Response.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const org =
      organizationId
        ? { id: organizationId }
        : await getOrCreateDefaultOrganization();

    const buyer = await db.buyer.create({
      data: {
        organizationId: org.id,
        name,
        companyName,
        contactName,
        email,
        webhookUrl,
        pingUrl,
        postUrl,
        timeoutMs:
          typeof timeoutMs !== "undefined" && timeoutMs !== null && timeoutMs !== ""
            ? Number(timeoutMs)
            : 1500,
        minBid:
          typeof minBid !== "undefined" && minBid !== null && minBid !== ""
            ? Number(minBid)
            : null,
        status: status ?? "active",
        pricePerLead:
          typeof pricePerLead !== "undefined" &&
          pricePerLead !== null &&
          pricePerLead !== ""
            ? Number(pricePerLead)
            : null,
        acceptedStates,
        requiredFields,
        notes,
        acceptanceMode: acceptanceMode || "standard",
        acceptancePath: acceptancePath || null,
        acceptanceValue: acceptanceValue || null,
        payoutPath: payoutPath || null,
      },
    });

    return Response.json({ data: buyer }, { status: 201 });
  } catch (error) {
    console.error("Buyer POST error:", error);

    return Response.json(
      { error: "Failed to create buyer" },
      { status: 500 }
    );
  }
}