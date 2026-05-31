import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import * as cheerio from "cheerio";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

interface ScraperConfig {
  name: string;
  slug: string;
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
    url: "https://www.looke.com.br/planos",
    selectors: { plans: ".plan-card", name: ".plan-name", price: ".plan-price" },
  },
];

async function scrapePlatform(config: ScraperConfig) {
  console.log(`Scraping ${config.name}...`);

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

async function updatePlatform(slug: string, scrapedPlans: { name: string; price: number }[]) {
  const platform = await prisma.platform.findUnique({
    where: { slug },
    include: { plans: true },
  });

  if (!platform) {
    console.warn(`  Platform ${slug} not found in DB`);
    return;
  }

  for (const sp of scrapedPlans) {
    const existingPlan = platform.plans.find(
      (p) => p.name.toLowerCase() === sp.name.toLowerCase()
    );

    if (existingPlan) {
      const latestHistory = await prisma.priceHistory.findFirst({
        where: { planId: existingPlan.id },
        orderBy: { recordedAt: "desc" },
      });

      if (latestHistory && Math.abs(latestHistory.price - sp.price) > 0.01) {
        await prisma.priceHistory.create({
          data: { planId: existingPlan.id, price: sp.price },
        });

        await prisma.changeLog.create({
          data: {
            type: "PRICE_CHANGE",
            description: `${platform.name}: ${existingPlan.name} mudou de R$ ${latestHistory.price.toFixed(2)} para R$ ${sp.price.toFixed(2)}`,
            platformId: platform.id,
            oldValue: String(latestHistory.price),
            newValue: String(sp.price),
          },
        });

        console.log(`  ⚡ ${existingPlan.name}: R$ ${latestHistory.price} → R$ ${sp.price}`);
      }
    } else {
      const newPlan = await prisma.plan.create({
        data: {
          platformId: platform.id,
          name: sp.name,
          price: sp.price,
          ads: false,
        },
      });

      await prisma.priceHistory.create({
        data: { planId: newPlan.id, price: sp.price },
      });

      await prisma.changeLog.create({
        data: {
          type: "PLAN_CHANGE",
          description: `${platform.name}: Novo plano "${sp.name}" por R$ ${sp.price.toFixed(2)}`,
          platformId: platform.id,
          newValue: String(sp.price),
        },
      });

      console.log(`  🆕 Novo plano: ${sp.name} - R$ ${sp.price}`);
    }
  }
}

async function main() {
  console.log("=== StreamingDB Scraper ===\n");

  for (const config of scrapers) {
    const plans = await scrapePlatform(config);
    if (plans.length > 0) {
      await updatePlatform(config.slug, plans);
    }
  }

  console.log("\n=== Scraping complete ===");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
