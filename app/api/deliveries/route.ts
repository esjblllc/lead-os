import { db } from "@/lib/db";

export async function GET() {
  const deliveries = await db.delivery.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      lead: true,
      buyer: true,
    },
  });

  return Response.json({ data: deliveries });
}