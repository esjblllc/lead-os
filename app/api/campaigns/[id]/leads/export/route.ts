import { db } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import {
  getRequestSessionUser,
  isPlatformAdmin,
} from "@/lib/request-session-user";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function formatDate(value: Date | string) {
  return new Date(value).toISOString();
}

function getDateBounds(from?: string | null, to?: string | null) {
  return {
    startDate: from ? new Date(`${from}T00:00:00`) : null,
    endDate: to ? new Date(`${to}T23:59:59.999`) : null,
  };
}

function buildFilename(slug: string) {
  const safeSlug = slug.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-");
  const date = new Date().toISOString().slice(0, 10);
  return `${safeSlug || "campaign"}-leads-${date}.csv`;
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { id } = await context.params;
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const sort = url.searchParams.get("sort") === "asc" ? "asc" : "desc";
    const { startDate, endDate } = getDateBounds(from, to);

    const campaign = await db.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        name: true,
        slug: true,
      },
    });

    if (!campaign) {
      return new Response("Campaign not found", { status: 404 });
    }

    if (
      !isPlatformAdmin(sessionUser) &&
      campaign.organizationId !== sessionUser.organizationId
    ) {
      return new Response("Forbidden", { status: 403 });
    }

    const leads = await db.lead.findMany({
      where: {
        campaignId: campaign.id,
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        supplier: {
          select: {
            name: true,
          },
        },
        assignedBuyer: {
          select: {
            name: true,
            pricePerLead: true,
          },
        },
        trackingCampaign: {
          select: {
            name: true,
          },
        },
        trackingLink: {
          select: {
            name: true,
            slug: true,
          },
        },
        deliveries: {
          orderBy: { createdAt: "desc" },
          select: {
            status: true,
            attemptNumber: true,
            statusCode: true,
            createdAt: true,
          },
        },
        pingResults: {
          orderBy: { createdAt: "desc" },
          select: {
            status: true,
            bid: true,
            won: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: sort },
    });

    const csv = toCsv(
      [
        "Lead ID",
        "Campaign",
        "Created At",
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "State",
        "Zip",
        "Routing Status",
        "Supplier",
        "Assigned Buyer",
        "Revenue",
        "Cost",
        "Profit",
        "Margin %",
        "Source",
        "Sub ID",
        "Publisher ID",
        "Custom Data",
        "Click ID",
        "Tracking Campaign",
        "Tracking Link",
        "Latest Delivery Status",
        "Latest Delivery Attempt",
        "Latest Delivery Status Code",
        "Latest Delivery At",
        "Latest Ping Status",
        "Latest Ping Bid",
        "Latest Ping Won",
        "Latest Ping At",
      ],
      leads.map((lead) => {
        const latestDelivery = lead.deliveries[0];
        const latestPing = lead.pingResults[0];
        const buyerRevenue = toNumber(lead.assignedBuyer?.pricePerLead);
        const revenue =
          buyerRevenue !== null
            ? buyerRevenue
            : (toNumber(lead.cost) || 0) + (toNumber(lead.profit) || 0);

        return [
          lead.id,
          campaign.name,
          formatDate(lead.createdAt),
          lead.firstName,
          lead.lastName,
          lead.email,
          lead.phone,
          lead.state,
          lead.zip,
          lead.routingStatus,
          lead.supplier?.name,
          lead.assignedBuyer?.name,
          revenue,
          toNumber(lead.cost),
          toNumber(lead.profit),
          toNumber(lead.marginPct),
          lead.source,
          lead.subId,
          lead.publisherId,
          lead.customData,
          lead.clickId,
          lead.trackingCampaign?.name,
          lead.trackingLink?.name || lead.trackingLink?.slug,
          latestDelivery?.status,
          latestDelivery?.attemptNumber,
          latestDelivery?.statusCode,
          latestDelivery?.createdAt ? formatDate(latestDelivery.createdAt) : "",
          latestPing?.status,
          toNumber(latestPing?.bid),
          typeof latestPing?.won === "boolean" ? String(latestPing.won) : "",
          latestPing?.createdAt ? formatDate(latestPing.createdAt) : "",
        ];
      })
    );

    return csvResponse(buildFilename(campaign.slug), csv);
  } catch (error) {
    console.error("Campaign leads export error:", error);
    return new Response("Failed to export campaign leads", { status: 500 });
  }
}
