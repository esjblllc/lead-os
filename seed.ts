import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in .env");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: "test-org" },
  });

  const org =
    existingOrg ??
    (await prisma.organization.create({
      data: {
        name: "Test Org",
        slug: "test-org",
      },
    }));

  const existingCampaign = await prisma.campaign.findFirst({
    where: {
      slug: "auto-accident",
      organizationId: org.id,
    },
  });

  const campaign =
    existingCampaign ??
    (await prisma.campaign.create({
      data: {
        name: "Auto Accident Campaign",
        slug: "auto-accident",
        vertical: "legal",
        routingMode: "round_robin",
        status: "active",
        organizationId: org.id,
      },
    }));

  const existingBuyer = await prisma.buyer.findFirst({
    where: {
      organizationId: org.id,
      name: "Buyer One",
    },
  });

const buyer =
  existingBuyer ??
  (await prisma.buyer.create({
    data: {
      organizationId: org.id,
      name: "Buyer One",
      email: "buyer1@example.com",
      webhookUrl: "https://webhook.site/test-url", // temp
      status: "active",
    },
  }));

  const existingLink = await prisma.campaignBuyer.findFirst({
    where: {
      campaignId: campaign.id,
      buyerId: buyer.id,
    },
  });

  if (!existingLink) {
    await prisma.campaignBuyer.create({
      data: {
        campaignId: campaign.id,
        buyerId: buyer.id,
        priority: 1,
      },
    });
  }

  console.log("Seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });