import { db } from "@/lib/db";
import { generateApiKey } from "@/lib/api-key";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const existingSupplier = await db.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return Response.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    const updated = await db.supplier.update({
      where: { id },
      data: {
        apiKey: generateApiKey(),
      },
    });

    return Response.json({ data: updated });
  } catch (error) {
    console.error("Regenerate supplier API key error:", error);

    return Response.json(
      { error: "Failed to regenerate API key" },
      { status: 500 }
    );
  }
}