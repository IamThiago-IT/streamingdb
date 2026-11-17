import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db-adapter";
import { countries, getCountryCurrency, isCountry } from "@/lib/countries";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const STALE_DAYS = 7;
const VALID_CYCLES = new Set(["MONTHLY", "ANNUAL", "QUARTERLY"]);
const VALID_STATUSES = new Set(["ACTIVE", "STALE", "PENDING"]);

async function main() {
  const platforms = await prisma.platform.findMany({
    include: {
      plans: { include: { offers: true } },
      platformCountries: true,
      priceSources: { where: { isActive: true } },
    },
    orderBy: { name: "asc" },
  });

  const errors: string[] = [];
  const warnings: string[] = [];
  const staleBefore = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  for (const platform of platforms) {
    for (const plan of platform.plans) {
      if (!plan.tierKey) {
        warnings.push(`${platform.name} / ${plan.name}: tierKey vazio`);
      }

      for (const offer of plan.offers) {
        const label = `${platform.name} / ${plan.name} / ${offer.countryCode} / ${offer.billingCycle}`;
        const amount = Number(offer.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
          errors.push(`${label}: amount inválido (${offer.amount})`);
        }

        if (!isCountry(offer.countryCode)) {
          errors.push(`${label}: país não suportado (${offer.countryCode})`);
        } else if (offer.currency !== getCountryCurrency(offer.countryCode)) {
          errors.push(
            `${label}: moeda ${offer.currency} ≠ moeda do país ${getCountryCurrency(offer.countryCode)}`
          );
        }

        if (!VALID_CYCLES.has(offer.billingCycle)) {
          errors.push(`${label}: billingCycle inválido`);
        }

        if (!VALID_STATUSES.has(offer.status)) {
          errors.push(`${label}: status inválido (${offer.status})`);
        }

        const expectedMonths =
          offer.billingCycle === "ANNUAL"
            ? 12
            : offer.billingCycle === "QUARTERLY"
              ? 3
              : 1;
        if (offer.billingMonths !== expectedMonths) {
          warnings.push(
            `${label}: billingMonths=${offer.billingMonths}, esperado ${expectedMonths}`
          );
        }

        if (offer.lastSuccessAt && offer.lastSuccessAt < staleBefore) {
          warnings.push(
            `${label}: última verificação em ${offer.lastSuccessAt.toISOString().slice(0, 10)}`
          );
        }
      }
    }
  }

  console.log("\n=== Cobertura plataforma × país ===\n");
  const header = ["Plataforma", ...countries.map((country) => country.code)];
  console.log(header.join("\t"));

  for (const platform of platforms) {
    const statusByCountry = new Map(
      platform.platformCountries.map((row) => [row.countryCode, row.status])
    );
    const cells = countries.map((country) => {
      const offers = platform.plans.flatMap((plan) =>
        plan.offers.filter((offer) => offer.countryCode === country.code)
      );
      const status =
        statusByCountry.get(country.code) ??
        (offers.length > 0 ? "OPERATES" : "UNKNOWN");

      if (status === "NOT_AVAILABLE") {
        if (offers.length > 0) {
          errors.push(
            `${platform.name} / ${country.code}: NOT_AVAILABLE mas tem ${offers.length} oferta(s)`
          );
        }
        return "—";
      }

      if (status === "UNKNOWN" && offers.length === 0) return "?";
      if (offers.length === 0) {
        warnings.push(
          `${platform.name} / ${country.code}: OPERATES sem oferta coletada`
        );
        return "0";
      }

      return String(offers.length);
    });

    console.log([platform.name, ...cells].join("\t"));
  }

  console.log("\nLegenda: número = ofertas | — = não disponível | ? = não coletado | 0 = opera sem oferta");

  console.log("\n=== Fontes de preço ativas ===\n");
  for (const platform of platforms) {
    for (const source of platform.priceSources) {
      console.log(
        `  ${platform.name} / ${source.countryCode}: ${source.parserKey} (${source.renderMode}) ${source.url}`
      );
    }
  }

  if (warnings.length > 0) {
    console.log(`\nAvisos (${warnings.length}):`);
    for (const warning of warnings) console.log(`  - ${warning}`);
  }

  if (errors.length > 0) {
    console.error(`\nErros (${errors.length}):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  } else {
    console.log("\nNenhum erro estrutural encontrado.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
