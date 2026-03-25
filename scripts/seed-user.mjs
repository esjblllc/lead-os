import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function main() {
  const email = process.env.SEED_USER_EMAIL || "admin@example.com";
  const password = process.env.SEED_USER_PASSWORD || "admin123";
  const orgName = process.env.SEED_ORG_NAME || "Default Organization";

  let org = await prisma.organization.findFirst({
    where: { name: orgName },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: { name: orgName },
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { email },
      data: {
        passwordHash: sha256(password),
        status: "active",
        role: "admin",
        organizationId: org.id,
      },
    });

    console.log("Updated user:", updated.email);
    return;
  }

  const created = await prisma.user.create({
    data: {
      organizationId: org.id,
      email,
      passwordHash: sha256(password),
      role: "admin",
      status: "active",
    },
  });

  console.log("Created user:", created.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });