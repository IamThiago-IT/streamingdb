import "dotenv/config";
import Database from "better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Migra dados do SQLite legado (schema anterior a 0002_native_offers) para o
 * Postgres/Neon já no modelo de preço nativo.
 *
 * Uso:
 *   $env:TARGET_DATABASE_URL = "postgresql://..."; npx tsx scripts/migrate-sqlite-to-neon.ts
 *
 * Planos legados viram ofertas do Brasil em BRL; o histórico é remapeado para
 * a oferta correspondente. Preserva IDs e timestamps. Idempotente.
 */

const targetUrl = process.env.TARGET_DATABASE_URL;
if (!targetUrl?.startsWith("postgres")) {
  console.error(
    "Defina TARGET_DATABASE_URL com a connection string Postgres (Neon) antes de rodar."
  );
  process.exit(1);
}

const sourcePath = (
  process.env.SOURCE_DATABASE_URL ?? "file:./dev.db"
).replace(/^file:/, "");
const sqlite = new Database(sourcePath, { readonly: true });
const target = new PrismaClient({
  adapter: new PrismaPg({ connectionString: targetUrl }),
});

const d = (v: string | null) => (v == null ? null : new Date(v));
/** Datas obrigatórias no schema novo: usa agora quando a origem vier nula. */
const dr = (v: string | null) => d(v) ?? new Date();
const b = (v: number | null) => (v == null ? null : v !== 0);

const countryCodes = [
  "BR",
  "US",
  "CA",
  "GB",
  "AU",
  "MX",
  "DE",
  "PT",
  "ES",
  "JP",
  "IN",
  "KR",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type LegacyPlan = {
  id: string;
  platformId: string;
  name: string;
  price: number;
  billingCycle: string;
  quality: string | null;
  ads: number;
  createdAt: string;
  updatedAt: string;
};

type LegacyPriceHistory = {
  id: string;
  planId: string;
  price: number;
  recordedAt: string;
  createdAt: string;
};

async function copy(
  label: string,
  sql: string,
  map: (r: Record<string, unknown>) => Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  write: (rows: any[]) => Promise<unknown>
) {
  const rows = sqlite.prepare(sql).all() as Record<string, unknown>[];
  if (rows.length === 0) {
    console.log(`${label}: 0 registros (origem vazia)`);
    return 0;
  }
  await write(rows.map(map));
  console.log(`${label}: ${rows.length} registros migrados`);
  return rows.length;
}

async function main() {
  const counts: Record<string, number> = {};

  counts.Platform = await copy(
    "Platform",
    "SELECT * FROM Platform",
    (r) => ({
      ...r,
      createdAt: d(r.createdAt as string),
      updatedAt: d(r.updatedAt as string),
    }),
    (rows) => target.platform.createMany({ data: rows, skipDuplicates: true })
  );

  const legacyPlans = sqlite
    .prepare("SELECT * FROM Plan")
    .all() as LegacyPlan[];

  const usedTierKeys = new Map<string, Set<string>>();
  const planRows = legacyPlans.map((plan) => {
    const baseKey = slugify(plan.name) || plan.id;
    const used = usedTierKeys.get(plan.platformId) ?? new Set<string>();
    const tierKey = used.has(baseKey) ? `${baseKey}-${plan.id}` : baseKey;
    used.add(tierKey);
    usedTierKeys.set(plan.platformId, used);

    return {
      id: plan.id,
      platformId: plan.platformId,
      tierKey,
      name: plan.name,
      createdAt: dr(plan.createdAt),
      updatedAt: dr(plan.updatedAt),
    };
  });

  if (planRows.length > 0) {
    await target.plan.createMany({ data: planRows, skipDuplicates: true });
  }
  counts.Plan = planRows.length;
  console.log(`Plan: ${planRows.length} registros migrados`);

  const offerRows = legacyPlans.map((plan) => ({
    id: `br-${plan.id}`,
    planId: plan.id,
    countryCode: "BR",
    currency: "BRL",
    amount: plan.price,
    billingCycle: plan.billingCycle === "anual" ? "ANNUAL" : "MONTHLY",
    billingMonths: plan.billingCycle === "anual" ? 12 : 1,
    taxIncluded: true,
    displayName: plan.name,
    quality: plan.quality,
    ads: b(plan.ads) ?? false,
    sourceType: "LEGACY_SQLITE",
    status: "ACTIVE",
    lastCheckedAt: new Date(),
    lastSuccessAt: new Date(),
    createdAt: dr(plan.createdAt),
    updatedAt: dr(plan.updatedAt),
  }));

  if (offerRows.length > 0) {
    await target.planOffer.createMany({
      data: offerRows,
      skipDuplicates: true,
    });
  }
  counts.PlanOffer = offerRows.length;
  console.log(`PlanOffer: ${offerRows.length} registros migrados`);

  const legacyHistory = sqlite
    .prepare("SELECT * FROM PriceHistory")
    .all() as LegacyPriceHistory[];

  const historyRows = legacyHistory.map((history) => ({
    id: history.id,
    offerId: `br-${history.planId}`,
    amount: history.price,
    currency: "BRL",
    taxIncluded: true,
    recordedAt: dr(history.recordedAt),
    createdAt: dr(history.createdAt),
  }));

  if (historyRows.length > 0) {
    await target.priceHistory.createMany({
      data: historyRows,
      skipDuplicates: true,
    });
  }
  counts.PriceHistory = historyRows.length;
  console.log(`PriceHistory: ${historyRows.length} registros migrados`);

  counts.Content = await copy(
    "Content",
    "SELECT * FROM Content",
    (r) => ({
      ...r,
      createdAt: d(r.createdAt as string),
      updatedAt: d(r.updatedAt as string),
    }),
    (rows) => target.content.createMany({ data: rows, skipDuplicates: true })
  );

  counts.ContentAvailability = await copy(
    "ContentAvailability",
    "SELECT * FROM ContentAvailability",
    (r) => ({
      ...r,
      available: b(r.available as number),
      countryCode: (r.countryCode as string | null) ?? "BR",
      addedAt: d(r.addedAt as string),
      removedAt: d(r.removedAt as string | null),
      updatedAt: d(r.updatedAt as string),
    }),
    (rows) =>
      target.contentAvailability.createMany({
        data: rows,
        skipDuplicates: true,
      })
  );

  counts.ChangeLog = await copy(
    "ChangeLog",
    "SELECT * FROM ChangeLog",
    (r) => ({
      ...r,
      createdAt: d(r.createdAt as string),
      countryCode: r.type === "PRICE_CHANGE" ? "BR" : null,
      currency: r.type === "PRICE_CHANGE" ? "BRL" : null,
    }),
    (rows) => target.changeLog.createMany({ data: rows, skipDuplicates: true })
  );

  counts.User = await copy(
    "User",
    "SELECT * FROM User",
    (r) => ({
      ...r,
      emailVerified: b(r.emailVerified as number),
      createdAt: d(r.createdAt as string),
      updatedAt: d(r.updatedAt as string),
    }),
    (rows) => target.user.createMany({ data: rows, skipDuplicates: true })
  );

  counts.Session = await copy(
    "Session",
    "SELECT * FROM Session",
    (r) => ({
      ...r,
      expiresAt: d(r.expiresAt as string),
      createdAt: d(r.createdAt as string),
      updatedAt: d(r.updatedAt as string),
    }),
    (rows) => target.session.createMany({ data: rows, skipDuplicates: true })
  );

  counts.Account = await copy(
    "Account",
    "SELECT * FROM Account",
    (r) => ({
      ...r,
      expiresAt: d(r.expiresAt as string | null),
      createdAt: d(r.createdAt as string),
      updatedAt: d(r.updatedAt as string),
    }),
    (rows) => target.account.createMany({ data: rows, skipDuplicates: true })
  );

  counts.Verification = await copy(
    "Verification",
    "SELECT * FROM Verification",
    (r) => ({ ...r, createdAt: d(r.createdAt as string) }),
    (rows) =>
      target.verification.createMany({ data: rows, skipDuplicates: true })
  );

  const platforms = await target.platform.findMany({
    select: { id: true, slug: true },
  });

  const platformCountryRows = platforms.flatMap((platform) =>
    countryCodes.map((countryCode) => ({
      platformId: platform.id,
      countryCode,
      status:
        countryCode === "BR"
          ? "OPERATES"
          : ["looke", "globoplay"].includes(platform.slug)
            ? "NOT_AVAILABLE"
            : "UNKNOWN",
      updatedAt: new Date(),
    }))
  );

  if (platformCountryRows.length > 0) {
    await target.platformCountry.createMany({
      data: platformCountryRows,
      skipDuplicates: true,
    });
  }
  counts.PlatformCountry = platformCountryRows.length;

  const looke = platforms.find((platform) => platform.slug === "looke");
  if (looke) {
    await target.priceSource.createMany({
      data: [
        {
          id: `looke-br-${looke.id}`,
          platformId: looke.id,
          countryCode: "BR",
          url: "https://www.looke.com.br/planos",
          parserKey: "looke",
          renderMode: "HTTP",
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });
    counts.PriceSource = 1;
  } else {
    counts.PriceSource = 0;
  }

  console.log("\n--- Verificação no destino (Neon) ---");
  const destCounts = {
    Platform: await target.platform.count(),
    Plan: await target.plan.count(),
    PlanOffer: await target.planOffer.count(),
    PriceHistory: await target.priceHistory.count(),
    Content: await target.content.count(),
    ContentAvailability: await target.contentAvailability.count(),
    ChangeLog: await target.changeLog.count(),
    User: await target.user.count(),
    Session: await target.session.count(),
    Account: await target.account.count(),
    Verification: await target.verification.count(),
    PlatformCountry: await target.platformCountry.count(),
    PriceSource: await target.priceSource.count(),
  };

  let ok = true;
  for (const [model, expected] of Object.entries(counts)) {
    const actual = destCounts[model as keyof typeof destCounts];
    const status = actual >= expected ? "OK" : "DIVERGE";
    if (actual < expected) ok = false;
    console.log(`${model}: origem=${expected} destino=${actual} ${status}`);
  }
  console.log(
    ok
      ? "\nMigração concluída e verificada."
      : "\nMigração com divergências!"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await target.$disconnect();
  });
