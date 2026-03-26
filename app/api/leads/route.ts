import { db } from "@/lib/db";
import { createLeadFromPayload } from "@/lib/lead-ingestion";
import {
  getRequestSessionUser,
  isPlatformAdmin,
} from "@/lib/request-session-user";

export async function GET(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leads = await db.lead.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : { organizationId: sessionUser.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        campaign: true,
        assignedBuyer: true,
        supplier: true,
        trackingCampaign: true,
        trackingLink: true,
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
      {
        error: "Failed to load leads",
        details: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (!body?.campaignId) {
      return Response.json(
        { error: "campaignId is required" },
        { status: 400 }
      );
    }

    const campaign = await db.campaign.findUnique({
      where: { id: body.campaignId },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!campaign) {
      return Response.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (
      !isPlatformAdmin(sessionUser) &&
      campaign.organizationId !== sessionUser.organizationId
    ) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const lead = await createLeadFromPayload({
      campaignId: body.campaignId,
      supplierId: body.supplierId ?? null,
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      source: body.source ?? null,
      subId: body.subId ?? null,
      publisherId: body.publisherId ?? null,
      cost: body.cost ?? null,
      clickId: body.clickId ?? null,
    });

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