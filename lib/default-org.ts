import { db } from "@/lib/db";

export async function getOrCreateDefaultOrganization() {
  const existing = await db.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  return db.organization.create({
    data: {
      name: "Default Organization",
    },
  });
}