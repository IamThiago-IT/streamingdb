import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db-adapter";
import { formatMoney } from "@/lib/money";
import {
  finishCollectionRun,
  startCollectionRun,
} from "@/lib/data-quality/ingest";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function detectPriceChanges() {
  console.log("=== Price Change Monitor ===\n");

  const runId = await startCollectionRun(prisma, {
    kind: "REFRESH",
    source: "scripts/monitor",
  });

  let checked = 0;
  let changes = 0;
  let failed = 0;

  try {
    const offers = await prisma.planOffer.findMany({
      include: {
        plan: { include: { platform: true } },
        history: { orderBy: { recordedAt: "desc" }, take: 2 },
      },
    });

    for (const offer of offers) {
      checked++;
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

      // Deduplicação por oferta e por mudança específica: uma nova queda de
      // preço no mesmo dia continua sendo registrada, mas reexecutar o
      // monitor não duplica o mesmo evento.
      const existingLog = await prisma.changeLog.findFirst({
        where: {
          type: "PRICE_CHANGE",
          entityType: "PLAN_OFFER",
          entityId: offer.id,
          field: "amount",
          newValue: String(latestAmount),
          createdAt: { gte: latest.recordedAt },
        },
      });

      if (existingLog) continue;

      await prisma.changeLog.create({
        data: {
          type: "PRICE_CHANGE",
          entityType: "PLAN_OFFER",
          entityId: offer.id,
          field: "amount",
          description: `${offer.plan.platform.name} (${offer.countryCode}): ${planName} ${arrow} de ${formatMoney(previousAmount, previous.currency, "pt-BR")} para ${formatMoney(latestAmount, latest.currency, "pt-BR")} (${pct}%)`,
          platformId: offer.plan.platformId,
          countryCode: offer.countryCode,
          currency: latest.currency,
          oldValue: String(previousAmount),
          newValue: String(latestAmount),
          source: latest.sourceType ?? offer.sourceType,
          process: "scripts/monitor",
          metadata: JSON.stringify({ priceHistoryId: latest.id }),
        },
      });
      changes++;
    }

    await finishCollectionRun(prisma, runId, {
      kind: "REFRESH",
      source: "scripts/monitor",
      status: "SUCCESS",
      offersFound: checked,
      recordsCreated: changes,
      recordsUnchanged: checked - changes,
    });
  } catch (error) {
    failed = 1;
    await finishCollectionRun(prisma, runId, {
      kind: "REFRESH",
      source: "scripts/monitor",
      status: "FAILED",
      offersFound: checked,
      recordsCreated: changes,
      recordsFailed: failed,
      errorCode: "INTERNAL_ERROR",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  console.log(`\n  ${changes} novas mudanças registradas`);
  await prisma.$disconnect();
}

detectPriceChanges().catch((error) => {
  console.error(error);
  process.exit(1);
});
