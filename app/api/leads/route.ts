import { db } from "@/lib/db";
import { createLeadFromPayload } from "@/lib/lead-ingestion";

export async function GET() {
  try {
    const leads = await db.lead.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        campaign: true,
        assignedBuyer: true,
        supplier: true,
        deliveries: {
          orderBy: { createdAt: "desc" },
        },
        pingResults: {
          orderBy: { createdAt: "desc" },
          include: {
            buyer: true,
          },
        },
      },
    });

    return Response.json({ data: leads });
  } catch (error: any) {
    console.error("Leads GET error:", error);
    return Response.json(
      { error: "Failed to load leads", details: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body?.campaignId) {
      return Response.json(
        { error: "campaignId is required" },
        { status: 400 }
      );
    }

    const lead = await createLeadFromPayload(body);
    return Response.json({ data: lead }, { status: 201 });
  } catch (error: any) {
    console.error("Lead POST error:", error);

    const message = error?.message ?? "Unknown error";
    const status =
      message === "Campaign not found" || message === "Supplier not found"
        ? 404
        : message === "campaignId is required"
        ? 400
        : 500;

    return Response.json(
      { error: "Failed to create lead", details: message },
      { status }
    );
  }
}