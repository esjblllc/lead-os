import { db } from "@/lib/db";
import { getOrCreateDefaultOrganization } from "@/lib/default-org";

export async function GET() {
  try {
    const [campaigns, buyers] = await Promise.all([
      db.campaign.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          buyerLinks: {
            include: {
              buyer: true,
            },
            orderBy: {
              priority: "asc",
            },
          },
          leads: {
            select: {
              id: true,
            },
          },
        },
      }),
      db.buyer.findMany({
        where: {
          status: "active",
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return Response.json({
      data: campaigns,
      meta: {
        buyers,
      },
    });
  } catch (error) {
    console.error("Campaign GET error:", error);

    return Response.json(
      { error: "Failed to fetch campaigns" },
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
      slug,
      vertical,
      routingMode,
      status,
    } = body;

    if (!name || !slug || !vertical || !routingMode) {
      return Response.json(
        { error: "name, slug, vertical, and routingMode are required" },
        { status: 400 }
      );
    }

    const org =
      organizationId
        ? { id: organizationId }
        : await getOrCreateDefaultOrganization();

    const campaign = await db.campaign.create({
      data: {
        organizationId: org.id,
        name,
        slug,
        vertical,
        routingMode,
        status: status ?? "active",
      },
    });

    return Response.json({ data: campaign }, { status: 201 });
  } catch (error: any) {
    console.error("Campaign POST error:", error);

    return Response.json(
      { error: error?.message ?? "Failed to create campaign" },
      { status: 500 }
    );
  }
}