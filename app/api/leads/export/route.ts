import { db } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import {
  getRequestSessionUser,
  isPlatformAdmin,
} from "@/lib/request-session-user";

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function formatDate(value: Date | string) {
  return new Date(value).toISOString();
}

function getPresetStartDate(range: string) {
  const now = new Date();

  if (range === "24h") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return null;
}

function getDateBounds(range: string, from?: string | null, to?: string | null) {
  if (from || to) {
    return {
      startDate: from ? new Date(`${from}T00:00:00`) : null,
      endDate: to ? new Date(`${to}T23:59:59.999`) : null,
    };
  }

  return {
    startDate: getPresetStartDate(range),
    endDate: null,
  };
}

function sortLeads<
  T extends {
    createdAt: Date;
    cost: unknown;
    profit: unknown;
    marginPct: unknown;
    assignedBuyer?: {
      pricePerLead?: unknown;
    } | null;
  }
>(leads: T[], sort: string) {
  const items = [...leads];

  const getRevenue = (item: T) => {
    const buyerRevenue = toNumber(item.assignedBuyer?.pricePerLead);
    if (buyerRevenue !== null) return buyerRevenue;

    const cost = toNumber(item.cost);
    const profit = toNumber(item.profit);
    if (cost === null && profit === null) return 0;
    return (cost || 0) + (profit || 0);
  };

  items.sort((left, right) => {
    const leftRevenue = getRevenue(left);
    const rightRevenue = getRevenue(right);
    const leftProfit = toNumber(left.profit) || 0;
    const rightProfit = toNumber(right.profit) || 0;
    const leftMargin = toNumber(left.marginPct) || 0;
    const rightMargin = toNumber(right.marginPct) || 0;

    if (sort === "created_asc") {
      return left.createdAt.getTime() - right.createdAt.getTime();
    }

    if (sort === "revenue_desc") {
      return rightRevenue - leftRevenue;
    }

    if (sort === "profit_desc") {
      return rightProfit - leftProfit;
    }

    if (sort === "margin_desc") {
      return rightMargin - leftMargin;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  return items;
}

function buildFilename() {
  const date = new Date().toISOString().slice(0, 10);
  return `leads-export-${date}.csv`;
}

export async function GET(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const status = url.searchParams.get("status") || "all";
    const buyerId = url.searchParams.get("buyerId") || "all";
    const campaignId = url.searchParams.get("campaignId") || "all";
    const supplierId = url.searchParams.get("supplierId") || "all";
    const range = url.searchParams.get("range") || "all";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const sort = url.searchParams.get("sort") || "created_desc";
    const { startDate, endDate } = getDateBounds(range, from, to);

    const where = {
      ...(isPlatformAdmin(sessionUser)
        ? {}
        : { organizationId: sessionUser.organizationId }),
      ...(status !== "all" ? { routingStatus: status } : {}),
      ...(buyerId !== "all" ? { assignedBuyerId: buyerId } : {}),
      ...(campaignId !== "all" ? { campaignId } : {}),
      ...(supplierId !== "all" ? { supplierId } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q } },
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q, mode: "insensitive" as const } },
              { source: { contains: q, mode: "insensitive" as const } },
              { subId: { contains: q, mode: "insensitive" as const } },
              { publisherId: { contains: q, mode: "insensitive" as const } },
              {
                campaign: {
                  is: {
                    name: { contains: q, mode: "insensitive" as const },
                  },
                },
              },
              {
                assignedBuyer: {
                  is: {
                    name: { contains: q, mode: "insensitive" as const },
                  },
                },
              },
              {
                supplier: {
                  is: {
                    name: { contains: q, mode: "insensitive" as const },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const leads = await db.lead.findMany({
      where,
      include: {
        campaign: {
          select: {
            name: true,
          },
        },
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
            buyer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const sortedLeads = sortLeads(leads, sort);

    const csv = toCsv(
      [
        "Lead ID",
        "Created At",
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "Campaign",
        "Supplier",
        "Assigned Buyer",
        "Routing Status",
        "State",
        "Zip",
        "Source",
        "Sub ID",
        "Publisher ID",
        "Custom Data",
        "Revenue",
        "Cost",
        "Profit",
        "Margin %",
        "Tracking Campaign",
        "Tracking Link",
        "Latest Delivery Status",
        "Latest Delivery Attempt",
        "Latest Delivery Status Code",
        "Latest Delivery At",
        "Latest Ping Buyer",
        "Latest Ping Status",
        "Latest Ping Bid",
        "Latest Ping Won",
        "Latest Ping At",
      ],
      sortedLeads.map((lead) => {
        const latestDelivery = lead.deliveries[0];
        const latestPing = lead.pingResults[0];
        const buyerRevenue = toNumber(lead.assignedBuyer?.pricePerLead);
        const revenue =
          buyerRevenue !== null
            ? buyerRevenue
            : (toNumber(lead.cost) || 0) + (toNumber(lead.profit) || 0);

        return [
          lead.id,
          formatDate(lead.createdAt),
          lead.firstName,
          lead.lastName,
          lead.email,
          lead.phone,
          lead.campaign?.name,
          lead.supplier?.name,
          lead.assignedBuyer?.name,
          lead.routingStatus,
          lead.state,
          lead.zip,
          lead.source,
          lead.subId,
          lead.publisherId,
          lead.customData,
          revenue,
          toNumber(lead.cost),
          toNumber(lead.profit),
          toNumber(lead.marginPct),
          lead.trackingCampaign?.name,
          lead.trackingLink?.name || lead.trackingLink?.slug,
          latestDelivery?.status,
          latestDelivery?.attemptNumber,
          latestDelivery?.statusCode,
          latestDelivery?.createdAt ? formatDate(latestDelivery.createdAt) : "",
          latestPing?.buyer?.name,
          latestPing?.status,
          toNumber(latestPing?.bid),
          typeof latestPing?.won === "boolean" ? String(latestPing.won) : "",
          latestPing?.createdAt ? formatDate(latestPing.createdAt) : "",
        ];
      })
    );

    return csvResponse(buildFilename(), csv);
  } catch (error) {
    console.error("Leads export error:", error);
    return new Response("Failed to export leads", { status: 500 });
  }
}
