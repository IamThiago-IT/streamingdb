import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function detectPriceChanges() {
  console.log("=== Price Change Monitor ===\n");

  const plans = await prisma.plan.findMany({
    include: {
      platform: true,
      priceHistory: { orderBy: { recordedAt: "desc" }, take: 2 },
    },
  });

  let changes = 0;

  for (const plan of plans) {
    if (plan.priceHistory.length < 2) continue;

    const [latest, previous] = plan.priceHistory;
    const diff = latest.price - previous.price;

    if (Math.abs(diff) < 0.01) continue;

    const pct = ((diff / previous.price) * 100).toFixed(1);
    const arrow = diff > 0 ? "↑" : "↓";

    console.log(
      `  ${plan.platform.name} - ${plan.name}: R$ ${previous.price.toFixed(2)} ${arrow} R$ ${latest.price.toFixed(2)} (${pct}%)`
    );

    const existingLog = await prisma.changeLog.findFirst({
      where: {
        type: "PRICE_CHANGE",
        platformId: plan.platformId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (!existingLog) {
      await prisma.changeLog.create({
        data: {
          type: "PRICE_CHANGE",
          description: `${plan.platform.name}: ${plan.name} ${arrow} de R$ ${previous.price.toFixed(2)} para R$ ${latest.price.toFixed(2)} (${pct}%)`,
          platformId: plan.platformId,
          oldValue: String(previous.price),
          newValue: String(latest.price),
        },
      });
      changes++;
    }
  }

  console.log(`\n  ${changes} novas mudanças registradas`);
  await prisma.$disconnect();
}

detectPriceChanges().catch(console.error);
