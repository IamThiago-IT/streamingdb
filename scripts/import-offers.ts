import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@/app/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db-adapter";
import { getCountry, isCountry } from "@/lib/countries";
import { formatMoney } from "@/lib/money";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const REQUIRED_COLUMNS = [
  "platform_slug",
  "country_code",
  "tier_key",
  "display_name",
  "currency",
  "amount",
  "billing_cycle",
  "billing_months",
  "tax_included",
  "quality",
  "ads",
  "source_url",
  "source_type",
  "verified_at",
] as const;

type Column = (typeof REQUIRED_COLUMNS)[number];
type Row = Record<Column, string>;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseBoolean(value: string): boolean {
  return ["true", "1", "sim", "yes"].includes(value.trim().toLowerCase());
}

function parseTaxIncluded(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return parseBoolean(normalized);
}

function parseAmount(value: string): number {
  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return Number.NaN;

  // Aceita "1.234,56" e "1,234.56" sem ambiguidade.
  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    return Number(
      lastComma > lastDot
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "")
    );
  }

  return Number(normalized.replace(",", "."));
}

function readRows(file: string): Row[] {
  const cells = parseCsv(readFileSync(file, "utf8"));
  if (cells.length === 0) {
    throw new Error("CSV vazio");
  }

  const header = cells[0].map((cell) =>
    cell.replace(/^\uFEFF/, "").trim()
  );
  const missing = REQUIRED_COLUMNS.filter(
    (column) => !header.includes(column)
  );
  if (missing.length > 0) {
    throw new Error(`Colunas ausentes: ${missing.join(", ")}`);
  }

  const index = new Map(header.map((name, i) => [name, i]));

  return cells.slice(1).map((cellsRow) => {
    const row = {} as Row;
    for (const column of REQUIRED_COLUMNS) {
      row[column] = cellsRow[index.get(column) ?? -1]?.trim() ?? "";
    }
    return row;
  });
}

type ImportResult = {
  created: number;
  updated: number;
  unchanged: number;
  errors: string[];
};

async function importRow(row: Row, dryRun: boolean): Promise<"created" | "updated" | "unchanged"> {
  const countryCode = row.country_code.toUpperCase();
  if (!isCountry(countryCode)) {
    throw new Error(`país não suportado: ${countryCode}`);
  }

  const expectedCurrency = getCountry(countryCode).currency;
  const currency = row.currency.toUpperCase() || expectedCurrency;
  if (currency !== expectedCurrency) {
    throw new Error(
      `moeda ${currency} não corresponde ao país ${countryCode} (${expectedCurrency})`
    );
  }

  const amount = parseAmount(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`amount inválido: ${row.amount}`);
  }

  const billingCycle = row.billing_cycle.toUpperCase() || "MONTHLY";
  if (!["MONTHLY", "ANNUAL", "QUARTERLY"].includes(billingCycle)) {
    throw new Error(`billing_cycle inválido: ${row.billing_cycle}`);
  }

  const billingMonths =
    Number(row.billing_months) ||
    (billingCycle === "ANNUAL" ? 12 : billingCycle === "QUARTERLY" ? 3 : 1);
  const taxIncluded = parseTaxIncluded(row.tax_included);
  const ads = parseBoolean(row.ads);
  const displayName = row.display_name;
  const tierKey = row.tier_key || slugify(displayName);

  if (!displayName || !tierKey) {
    throw new Error("display_name e tier_key são obrigatórios");
  }

  const platform = await prisma.platform.findUnique({
    where: { slug: row.platform_slug },
  });
  if (!platform) {
    throw new Error(`plataforma não encontrada: ${row.platform_slug}`);
  }

  let plan = await prisma.plan.findFirst({
    where: { platformId: platform.id, tierKey },
  });
  if (!plan) {
    if (dryRun) {
      return "created";
    }
    plan = await prisma.plan.create({
      data: { platformId: platform.id, tierKey, name: displayName },
    });
  }

  const verifiedAt = row.verified_at
    ? new Date(row.verified_at)
    : new Date();
  if (Number.isNaN(verifiedAt.getTime())) {
    throw new Error(`verified_at inválido: ${row.verified_at}`);
  }

  const existing = await prisma.planOffer.findUnique({
    where: {
      planId_countryCode_billingCycle: {
        planId: plan.id,
        countryCode,
        billingCycle,
      },
    },
    include: { history: { orderBy: { recordedAt: "desc" }, take: 1 } },
  });

  const data = {
    planId: plan.id,
    countryCode,
    currency,
    amount,
    billingCycle,
    billingMonths,
    taxIncluded,
    displayName,
    quality: row.quality || null,
    ads,
    sourceUrl: row.source_url || null,
    sourceType: row.source_type || "MANUAL",
    status: "ACTIVE",
    lastCheckedAt: verifiedAt,
    lastSuccessAt: verifiedAt,
  };

  const previousAmount = Number(
    existing?.history[0]?.amount ?? existing?.amount ?? amount
  );
  const previousCurrency =
    existing?.history[0]?.currency ?? existing?.currency ?? currency;
  const priceChanged = existing
    ? Math.abs(previousAmount - amount) > 0.01 || previousCurrency !== currency
    : false;
  const needsHistory = existing ? existing.history.length === 0 : false;

  if (dryRun) {
    return existing
      ? priceChanged || needsHistory
        ? "updated"
        : "unchanged"
      : "created";
  }

  if (!existing) {
    const offer = await prisma.planOffer.create({ data });
    await prisma.priceHistory.create({
      data: {
        offerId: offer.id,
        amount,
        currency,
        taxIncluded,
        recordedAt: verifiedAt,
      },
    });
    await prisma.changeLog.create({
      data: {
        type: "PLAN_CHANGE",
        description: `${platform.name} (${countryCode}): Nova oferta "${displayName}" por ${formatMoney(amount, currency, "pt-BR")}`,
        platformId: platform.id,
        countryCode,
        currency,
        newValue: String(amount),
      },
    });
  } else {
    await prisma.planOffer.update({
      where: { id: existing.id },
      data,
    });

    if (priceChanged || needsHistory) {
      await prisma.priceHistory.create({
        data: {
          offerId: existing.id,
          amount,
          currency,
          taxIncluded,
          recordedAt: verifiedAt,
        },
      });
    }

    if (priceChanged) {
      await prisma.changeLog.create({
        data: {
          type: "PRICE_CHANGE",
          description: `${platform.name} (${countryCode}): ${displayName} mudou de ${formatMoney(previousAmount, previousCurrency, "pt-BR")} para ${formatMoney(amount, currency, "pt-BR")}`,
          platformId: platform.id,
          countryCode,
          currency,
          oldValue: String(previousAmount),
          newValue: String(amount),
        },
      });
    }
  }

  await prisma.platformCountry.upsert({
    where: {
      platformId_countryCode: {
        platformId: platform.id,
        countryCode,
      },
    },
    update: { status: "OPERATES" },
    create: {
      platformId: platform.id,
      countryCode,
      status: "OPERATES",
    },
  });

  return existing
    ? priceChanged || needsHistory
      ? "updated"
      : "unchanged"
    : "created";
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg =
    args.find((arg) => arg.startsWith("--file="))?.slice("--file=".length) ??
    args.find((arg) => !arg.startsWith("--"));
  const dryRun = args.includes("--dry-run");

  if (!fileArg) {
    console.error(
      "Uso: pnpm seed:offers --file=caminho.csv [--dry-run]"
    );
    process.exit(1);
  }

  const rows = readRows(fileArg);
  const result: ImportResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
  };

  for (const [i, row] of rows.entries()) {
    try {
      const status = await importRow(row, dryRun);
      result[status]++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`linha ${i + 2}: ${message}`);
    }
  }

  console.log(`\n=== Importação de ofertas${dryRun ? " (dry-run)" : ""} ===`);
  console.log(`  novas: ${result.created}`);
  console.log(`  atualizadas: ${result.updated}`);
  console.log(`  sem mudança de preço: ${result.unchanged}`);

  if (result.errors.length > 0) {
    console.error("\nErros:");
    for (const error of result.errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
