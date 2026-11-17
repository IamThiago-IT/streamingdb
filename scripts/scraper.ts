import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db-adapter";
import * as cheerio from "cheerio";
import { formatMoney } from "@/lib/money";

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

async function scrapePlatform(config: ScraperConfig) {
  console.log(`Scraping ${config.name} (${config.countryCode})...`);

  try {
    const res = await fetch(config.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StreamingDB/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`  ${config.name}: HTTP ${res.status} - skipping`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const plans: { name: string; price: number }[] = [];

    $(config.selectors.plans).each((_, el) => {
      const name = $(el).find(config.selectors.name).text().trim();
      const priceText = $(el).find(config.selectors.price).text().trim();
      const price = parseFloat(priceText.replace(/[^0-9,]/g, "").replace(",", "."));

      if (name && !isNaN(price)) {
        plans.push({ name, price });
      }
    });

    console.log(`  Found ${plans.length} plans for ${config.name}`);
    return plans;
  } catch (err) {
    console.warn(`  ${config.name}: Error - ${err}`);
    return [];
  }
}

async function updatePlatform(
  config: ScraperConfig,
  scrapedPlans: { name: string; price: number }[]
) {
  const platform = await prisma.platform.findUnique({
    where: { slug: config.slug },
    include: {
      plans: {
        include: {
          offers: {
            where: {
              countryCode: config.countryCode,
              billingCycle: "MONTHLY",
            },
            include: {
              history: { orderBy: { recordedAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!platform) {
    console.warn(`  Platform ${config.slug} not found in DB`);
    return;
  }

  for (const scrapedPlan of scrapedPlans) {
    const tierKey = slugify(scrapedPlan.name);
    const existingPlan = platform.plans.find(
      (plan) =>
        plan.tierKey === tierKey ||
        plan.name.toLowerCase() === scrapedPlan.name.toLowerCase()
    );

    let planId: string;
    if (existingPlan) {
      planId = existingPlan.id;
    } else {
      const created = await prisma.plan.create({
        data: {
          platformId: platform.id,
          tierKey,
          name: scrapedPlan.name,
        },
      });
      planId = created.id;
    }

    const existingOffer = existingPlan?.offers[0];
    const now = new Date();

    if (existingOffer) {
      const latestHistory = existingOffer.history[0];
      const previousAmount = Number(
        latestHistory?.amount ?? existingOffer.amount
      );
      const previousCurrency = latestHistory?.currency ?? existingOffer.currency;

      if (Math.abs(previousAmount - scrapedPlan.price) > 0.01) {
        await prisma.priceHistory.create({
          data: {
            offerId: existingOffer.id,
            amount: scrapedPlan.price,
            currency: config.currency,
            taxIncluded: config.taxIncluded,
            recordedAt: now,
          },
        });

        await prisma.planOffer.update({
          where: { id: existingOffer.id },
          data: {
            amount: scrapedPlan.price,
            currency: config.currency,
            taxIncluded: config.taxIncluded,
            status: "ACTIVE",
            lastCheckedAt: now,
            lastSuccessAt: now,
          },
        });

        await prisma.changeLog.create({
          data: {
            type: "PRICE_CHANGE",
            description: `${platform.name} (${config.countryCode}): ${scrapedPlan.name} mudou de ${formatMoney(previousAmount, previousCurrency, config.locale)} para ${formatMoney(scrapedPlan.price, config.currency, config.locale)}`,
            platformId: platform.id,
            countryCode: config.countryCode,
            currency: config.currency,
            oldValue: String(previousAmount),
            newValue: String(scrapedPlan.price),
          },
        });

        console.log(
          `  ⚡ ${scrapedPlan.name}: ${formatMoney(previousAmount, previousCurrency, config.locale)} → ${formatMoney(scrapedPlan.price, config.currency, config.locale)}`
        );
      } else {
        await prisma.planOffer.update({
          where: { id: existingOffer.id },
          data: {
            status: "ACTIVE",
            lastCheckedAt: now,
            lastSuccessAt: now,
          },
        });
      }
    } else {
      const offer = await prisma.planOffer.create({
        data: {
          planId,
          countryCode: config.countryCode,
          currency: config.currency,
          amount: scrapedPlan.price,
          billingCycle: "MONTHLY",
          billingMonths: 1,
          taxIncluded: config.taxIncluded,
          displayName: scrapedPlan.name,
          ads: false,
          sourceUrl: config.url,
          sourceType: "OFFICIAL_WEB",
          status: "ACTIVE",
          lastCheckedAt: now,
          lastSuccessAt: now,
        },
      });

      await prisma.priceHistory.create({
        data: {
          offerId: offer.id,
          amount: scrapedPlan.price,
          currency: config.currency,
          taxIncluded: config.taxIncluded,
          recordedAt: now,
        },
      });

      await prisma.changeLog.create({
        data: {
          type: "PLAN_CHANGE",
          description: `${platform.name} (${config.countryCode}): Novo plano "${scrapedPlan.name}" por ${formatMoney(scrapedPlan.price, config.currency, config.locale)}`,
          platformId: platform.id,
          countryCode: config.countryCode,
          currency: config.currency,
          newValue: String(scrapedPlan.price),
        },
      });

      console.log(
        `  🆕 Novo plano: ${scrapedPlan.name} - ${formatMoney(scrapedPlan.price, config.currency, config.locale)}`
      );
    }
  }
}

async function main() {
  console.log("=== StreamingDB Scraper ===\n");

  for (const config of scrapers) {
    const plans = await scrapePlatform(config);
    if (plans.length > 0) {
      await updatePlatform(config, plans);
    }
  }

  console.log("\n=== Scraping complete ===");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
