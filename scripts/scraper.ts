import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db-adapter";
import * as cheerio from "cheerio";
import { formatMoney } from "@/lib/money";
import {
  COLLECTION_METHOD,
  VERIFICATION_STATUS,
} from "@/lib/data-quality/constants";
import {
  applyOffer,
  finishCollectionRun,
  recordOfferCheckFailure,
  startCollectionRun,
} from "@/lib/data-quality/ingest";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

interface ScraperConfig {
  name: string;
  slug: string;
  countryCode: string;
  currency: string;
  locale: string;
  taxIncluded: boolean;
  url: string;
  selectors: {
    plans: string;
    name: string;
    price: string;
  };
}

const scrapers: ScraperConfig[] = [
  {
    name: "Looke",
    slug: "looke",
    countryCode: "BR",
    currency: "BRL",
    locale: "pt-BR",
    taxIncluded: true,
    url: "https://www.looke.com.br/planos",
    selectors: { plans: ".plan-card", name: ".plan-name", price: ".plan-price" },
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type ScrapeOutcome =
  | { ok: true; httpStatus: number; plans: { name: string; price: number }[] }
  | {
      ok: false;
      httpStatus: number | null;
      errorCode: "HTTP_ERROR" | "TIMEOUT" | "NETWORK_ERROR" | "PARSE_EMPTY";
      error: string;
    };

async function scrapePlatform(config: ScraperConfig): Promise<ScrapeOutcome> {
  console.log(`Scraping ${config.name} (${config.countryCode})...`);

  let res: Response;
  try {
    res = await fetch(config.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StreamingDB/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timedOut = /timeout|aborted/i.test(message);
    return {
      ok: false,
      httpStatus: null,
      errorCode: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      error: message,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status,
      errorCode: "HTTP_ERROR",
      error: `HTTP ${res.status}`,
    };
  }

  try {
    const html = await res.text();
    const $ = cheerio.load(html);
    const plans: { name: string; price: number }[] = [];

    $(config.selectors.plans).each((_, el) => {
      const name = $(el).find(config.selectors.name).text().trim();
      const priceText = $(el).find(config.selectors.price).text().trim();
      const price = parseFloat(
        priceText.replace(/[^0-9,]/g, "").replace(",", ".")
      );

      if (name && Number.isFinite(price)) {
        plans.push({ name, price });
      }
    });

    if (plans.length === 0) {
      return {
        ok: false,
        httpStatus: res.status,
        errorCode: "PARSE_EMPTY",
        error: "nenhum plano reconhecido na página",
      };
    }

    console.log(`  Found ${plans.length} plans for ${config.name}`);
    return { ok: true, httpStatus: res.status, plans };
  } catch (error) {
    return {
      ok: false,
      httpStatus: res.status,
      errorCode: "PARSE_EMPTY",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function markCheckFailure(config: ScraperConfig, checkedAt: Date) {
  const offers = await prisma.planOffer.findMany({
    where: {
      countryCode: config.countryCode,
      billingCycle: "MONTHLY",
      plan: { platform: { slug: config.slug } },
    },
    select: { id: true },
  });

  for (const offer of offers) {
    await recordOfferCheckFailure(prisma, {
      offerId: offer.id,
      checkedAt,
    });
  }

  return offers.length;
}

async function updatePlatform(
  config: ScraperConfig,
  plans: { name: string; price: number }[]
) {
  const platform = await prisma.platform.findUnique({
    where: { slug: config.slug },
  });
  if (!platform) {
    throw new Error(`plataforma não encontrada: ${config.slug}`);
  }

  const counts = {
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
  };
  const now = new Date();

  for (const plan of plans) {
    const tierKey = slugify(plan.name);
    try {
      const result = await applyOffer(
        prisma,
        {
          platformId: platform.id,
          tierKey,
          planName: plan.name,
          countryCode: config.countryCode,
          currency: config.currency,
          amount: plan.price,
          billingCycle: "MONTHLY",
          billingMonths: 1,
          taxIncluded: config.taxIncluded,
          displayName: plan.name,
          ads: false,
          sourceUrl: config.url,
          sourceType: "OFFICIAL_WEB",
          status: "ACTIVE",
          source: "OFFICIAL_WEB",
          collectionMethod: COLLECTION_METHOD.SCRAPER,
          collectedAt: now,
          lastCheckedAt: now,
          lastVerifiedAt: now,
          verificationStatus: VERIFICATION_STATUS.VERIFIED,
        },
        { process: "scripts/scraper" }
      );

      counts[result.status === "created" ? "created" : result.status === "updated" ? "updated" : "unchanged"]++;
      if (result.priceChanged) {
        console.log(`  ⚡ ${plan.name}: preço atualizado`);
      } else if (result.status === "created") {
        console.log(
          `  🆕 Novo plano: ${plan.name} - ${formatMoney(plan.price, config.currency, config.locale)}`
        );
      }
    } catch (error) {
      counts.failed++;
      console.error(
        `  ✗ ${plan.name}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  return counts;
}

async function main() {
  console.log("=== StreamingDB Scraper ===\n");

  let hadFailure = false;

  for (const config of scrapers) {
    const runId = await startCollectionRun(prisma, {
      kind: "SCRAPE",
      platformId: (
        await prisma.platform.findUnique({
          where: { slug: config.slug },
          select: { id: true },
        })
      )?.id,
      countryCode: config.countryCode,
      source: config.url,
    });

    const startedAt = new Date();
    const outcome = await scrapePlatform(config);

    if (!outcome.ok) {
      // Falha de coleta não altera preço nem lastVerifiedAt: apenas
      // registra que a fonte foi consultada sem sucesso.
      const checked = await markCheckFailure(config, startedAt);
      await finishCollectionRun(prisma, runId, {
        kind: "SCRAPE",
        countryCode: config.countryCode,
        source: config.url,
        status: "FAILED",
        httpStatus: outcome.httpStatus,
        offersFound: 0,
        recordsFailed: checked,
        errorCode: outcome.errorCode,
        error: outcome.error,
      });
      console.error(
        `  ${config.name}: ${outcome.errorCode} - ${outcome.error}`
      );
      hadFailure = true;
      continue;
    }

    try {
      const counts = await updatePlatform(config, outcome.plans);
      await finishCollectionRun(prisma, runId, {
        kind: "SCRAPE",
        countryCode: config.countryCode,
        source: config.url,
        status: counts.failed > 0 ? "PARTIAL" : "SUCCESS",
        httpStatus: outcome.httpStatus,
        offersFound: outcome.plans.length,
        recordsCreated: counts.created,
        recordsUpdated: counts.updated,
        recordsUnchanged: counts.unchanged,
        recordsFailed: counts.failed,
        errorCode: counts.failed > 0 ? "INVALID_DATA" : null,
        error:
          counts.failed > 0
            ? `${counts.failed} oferta(s) rejeitada(s) pela validação`
            : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await finishCollectionRun(prisma, runId, {
        kind: "SCRAPE",
        countryCode: config.countryCode,
        source: config.url,
        status: "FAILED",
        httpStatus: outcome.httpStatus,
        offersFound: outcome.plans.length,
        errorCode: "INTERNAL_ERROR",
        error: message,
      });
      console.error(`  ${config.name}: ${message}`);
      hadFailure = true;
    }
  }

  console.log("\n=== Scraping complete ===");
  if (hadFailure) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
