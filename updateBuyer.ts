import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  await prisma.buyer.updateMany({
    data: {
      webhookUrl: "https://webhook.site/3ea121db-f293-40f0-82e6-49b26f0550b5",
    },
  });

  console.log("Buyer updated with webhook");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });