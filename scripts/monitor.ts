import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db-adapter";
import { formatMoney } from "@/lib/money";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function detectPriceChanges() {
  console.log("=== Price Change Monitor ===\n");

  const offers = await prisma.planOffer.findMany({
    include: {
      plan: { include: { platform: true } },
      history: { orderBy: { recordedAt: "desc" }, take: 2 },
    },
  });

  let changes = 0;

  for (const offer of offers) {
    if (offer.history.length < 2) continue;

    const [latest, previous] = offer.history;
    const latestAmount = Number(latest.amount);
    const previousAmount = Number(previous.amount);
    const diff = latestAmount - previousAmount;

    if (Math.abs(diff) < 0.01) continue;

    const pct = ((diff / previousAmount) * 100).toFixed(1);
    const arrow = diff > 0 ? "↑" : "↓";
    const planName = offer.displayName ?? offer.plan.name;

    console.log(
      `  ${offer.plan.platform.name} (${offer.countryCode}) - ${planName}: ${formatMoney(previousAmount, previous.currency, "pt-BR")} ${arrow} ${formatMoney(latestAmount, latest.currency, "pt-BR")} (${pct}%)`
    );

    const existingLog = await prisma.changeLog.findFirst({
      where: {
        type: "PRICE_CHANGE",
        platformId: offer.plan.platformId,
        countryCode: offer.countryCode,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (!existingLog) {
      await prisma.changeLog.create({
        data: {
          type: "PRICE_CHANGE",
          description: `${offer.plan.platform.name} (${offer.countryCode}): ${planName} ${arrow} de ${formatMoney(previousAmount, previous.currency, "pt-BR")} para ${formatMoney(latestAmount, latest.currency, "pt-BR")} (${pct}%)`,
          platformId: offer.plan.platformId,
          countryCode: offer.countryCode,
          currency: latest.currency,
          oldValue: String(previousAmount),
          newValue: String(latestAmount),
        },
      });
      changes++;
    }
  }

  console.log(`\n  ${changes} novas mudanças registradas`);
  await prisma.$disconnect();
}

detectPriceChanges().catch(console.error);
