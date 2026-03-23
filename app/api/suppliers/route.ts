import { db } from "@/lib/db";
import { generateApiKey } from "@/lib/api-key";
import { getOrCreateDefaultOrganization } from "@/lib/default-org";

export async function GET() {
  const suppliers = await db.supplier.findMany({
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ data: suppliers });
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
      trafficSource,
      defaultCost,
      status,
      acceptedVerticals,
      notes,
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

    const supplier = await db.supplier.create({
      data: {
        organizationId: org.id,
        name,
        companyName,
        contactName,
        email,
        trafficSource,
        defaultCost:
          typeof defaultCost !== "undefined" &&
          defaultCost !== null &&
          defaultCost !== ""
            ? Number(defaultCost)
            : null,
        apiKey: generateApiKey(),
        status: status ?? "active",
        acceptedVerticals,
        notes,
      },
    });

    return Response.json({ data: supplier }, { status: 201 });
  } catch (error) {
    console.error("Supplier POST error:", error);

    return Response.json(
      { error: "Failed to create supplier" },
      { status: 500 }
    );
  }
}