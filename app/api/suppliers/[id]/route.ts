import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  const supplier = await db.supplier.findUnique({
    where: { id },
  });

  if (!supplier) {
    return Response.json(
      { error: "Supplier not found" },
      { status: 404 }
    );
  }

  return Response.json({ data: supplier });
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const {
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

    const existingSupplier = await db.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return Response.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    const updatedSupplier = await db.supplier.update({
      where: { id },
      data: {
        ...(typeof name !== "undefined" ? { name } : {}),
        ...(typeof companyName !== "undefined" ? { companyName } : {}),
        ...(typeof contactName !== "undefined" ? { contactName } : {}),
        ...(typeof email !== "undefined" ? { email } : {}),
        ...(typeof trafficSource !== "undefined" ? { trafficSource } : {}),
        ...(typeof defaultCost !== "undefined"
          ? {
              defaultCost:
                defaultCost === "" || defaultCost === null
                  ? null
                  : Number(defaultCost),
            }
          : {}),
        ...(typeof status !== "undefined" ? { status } : {}),
        ...(typeof acceptedVerticals !== "undefined"
          ? { acceptedVerticals }
          : {}),
        ...(typeof notes !== "undefined" ? { notes } : {}),
      },
    });

    return Response.json({ data: updatedSupplier });
  } catch (error) {
    console.error("Supplier PATCH error:", error);

    return Response.json(
      { error: "Failed to update supplier" },
      { status: 500 }
    );
  }
}