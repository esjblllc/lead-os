import { db } from "@/lib/db";
import { getRequestSessionUser, isPlatformAdmin } from "@/lib/request-session-user";

export async function GET(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const suppliers = await db.supplier.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : { organizationId: sessionUser.organizationId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ data: suppliers });
  } catch (error) {
    console.error("Suppliers GET error:", error);

    return Response.json(
      { error: "Failed to fetch suppliers" },
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
    const {
      name,
      companyName,
      contactName,
      email,
      trafficSource,
      defaultCost,
      apiKey,
      status,
      acceptedVerticals,
      notes,
    } = body;

    if (!name || !apiKey) {
      return Response.json(
        { error: "name and apiKey are required" },
        { status: 400 }
      );
    }

    const supplier = await db.supplier.create({
      data: {
        organizationId: sessionUser.organizationId,
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
        apiKey,
        status: status || "active",
        acceptedVerticals,
        notes,
      },
    });

    return Response.json({ data: supplier }, { status: 201 });
  } catch (error) {
    console.error("Suppliers POST error:", error);

    return Response.json(
      { error: "Failed to create supplier" },
      { status: 500 }
    );
  }
}