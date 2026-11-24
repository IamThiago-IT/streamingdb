import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db-adapter";
import {
  getFreshnessPolicy,
  staleCutoff,
} from "@/lib/data-quality/freshness";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

/**
 * Sinaliza ofertas verificadas cujo `lastVerifiedAt` já passou da política.
 * Por padrão apenas lista (dry-run). Com `--apply`, marca `status=STALE` e
 * registra auditoria. Preço, `lastVerifiedAt` e proveniência não são tocados.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const countryCode = process.argv
    .find((arg) => arg.startsWith("--country="))
    ?.slice("--country=".length)
    .toUpperCase();
  const now = new Date();
  const policy = getFreshnessPolicy("offer");
  const cutoff = staleCutoff(policy, now);

  const offers = await prisma.planOffer.findMany({
    where: {
      verificationStatus: "VERIFIED",
      lastVerifiedAt: { lt: cutoff },
      status: { not: "STALE" },
      ...(countryCode ? { countryCode } : {}),
    },
    include: { plan: { include: { platform: true } } },
    orderBy: { lastVerifiedAt: "asc" },
  });

  // Disponibilidades e países são apenas contabilizados: não existe um
  // status "stale" próprio, e mudar verificação automaticamente seria
  // confundir envelhecimento com perda de validade.
  const [staleAvailability, staleCountries] = await Promise.all([
    prisma.contentAvailability.count({
      where: {
        verificationStatus: "VERIFIED",
        lastVerifiedAt: { lt: staleCutoff(getFreshnessPolicy("availability"), now) },
      },
    }),
    prisma.platformCountry.count({
      where: {
        verificationStatus: "VERIFIED",
        lastVerifiedAt: {
          lt: staleCutoff(getFreshnessPolicy("platform-country"), now),
        },
      },
    }),
  ]);

  console.log(
    `=== Dados desatualizados (${apply ? "aplicando" : "dry-run"}) ===\n`
  );
  console.log(
    `Política de ofertas: ${policy.maxAgeHours}h · corte: ${cutoff.toISOString()}`
  );

  for (const offer of offers) {
    const label = `${offer.plan.platform.name} (${offer.countryCode}) - ${offer.displayName ?? offer.plan.name}`;
    const verifiedAt = offer.lastVerifiedAt?.toISOString() ?? "nunca";
    console.log(`  ${label}: verificado em ${verifiedAt}`);

    if (apply) {
      await prisma.$transaction([
        prisma.planOffer.update({
          where: { id: offer.id },
          data: { status: "STALE" },
        }),
        prisma.changeLog.create({
          data: {
            type: "OFFER_STALE",
            entityType: "PLAN_OFFER",
            entityId: offer.id,
            field: "status",
            description: `${label}: oferta marcada como desatualizada (última verificação em ${verifiedAt})`,
            platformId: offer.plan.platformId,
            countryCode: offer.countryCode,
            currency: offer.currency,
            oldValue: offer.status,
            newValue: "STALE",
            source: offer.sourceType,
            process: "scripts/refresh-stale",
            metadata: JSON.stringify({
              lastVerifiedAt: offer.lastVerifiedAt?.toISOString() ?? null,
              maxAgeHours: policy.maxAgeHours,
            }),
          },
        }),
      ]);
    }
  }

  console.log(
    `\nOfertas desatualizadas: ${offers.length}${apply ? " (marcadas como STALE)" : " (nenhuma alteração feita)"}`
  );
  console.log(
    `Disponibilidades verificadas desatualizadas: ${staleAvailability} · países: ${staleCountries}`
  );
  if (!apply && offers.length > 0) {
    console.log("\nExecute com --apply para marcar as ofertas como STALE.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
