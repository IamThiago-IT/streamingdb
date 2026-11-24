import "dotenv/config";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { PrismaClient } from "@/app/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db-adapter";
import { getCountry, isCountry } from "@/lib/countries";
import {
  COLLECTION_METHOD,
  VERIFICATION_STATUS,
} from "@/lib/data-quality/constants";
import {
  applyOffer,
  finishCollectionRun,
  startCollectionRun,
} from "@/lib/data-quality/ingest";

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

async function importRow(
  row: Row,
  dryRun: boolean
): Promise<"created" | "updated" | "unchanged"> {
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

  // `verified_at` é a declaração explícita de verificação da planilha.
  // Sem ele, o registro entra como UNVERIFIED e não pode sobrescrever
  // um preço já verificado.
  const verifiedAt = row.verified_at ? new Date(row.verified_at) : null;
  if (verifiedAt && Number.isNaN(verifiedAt.getTime())) {
    throw new Error(`verified_at inválido: ${row.verified_at}`);
  }
  const now = new Date();

  const result = await applyOffer(
    prisma,
    {
      platformSlug: row.platform_slug,
      tierKey,
      planName: displayName,
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
      sourceType: row.source_type || "CSV_IMPORT",
      status: "ACTIVE",
      source: row.source_type || "CSV_IMPORT",
      collectionMethod: COLLECTION_METHOD.CSV_IMPORT,
      collectedAt: verifiedAt ?? now,
      lastCheckedAt: verifiedAt ?? now,
      lastVerifiedAt: verifiedAt,
      verificationStatus: verifiedAt
        ? VERIFICATION_STATUS.VERIFIED
        : VERIFICATION_STATUS.UNVERIFIED,
    },
    { process: "scripts/import-offers", dryRun }
  );

  return result.status;
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

  // Toda importação executada deixa um registro auditável, inclusive
  // quando termina com falhas parciais.
  const runId = dryRun
    ? null
    : await startCollectionRun(prisma, {
        kind: "CSV_IMPORT",
        source: basename(fileArg),
        status: "RUNNING",
        offersFound: rows.length,
      });

  for (const [i, row] of rows.entries()) {
    try {
      const status = await importRow(row, dryRun);
      result[status]++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`linha ${i + 2}: ${message}`);
    }
  }

  if (runId) {
    await finishCollectionRun(prisma, runId, {
      kind: "CSV_IMPORT",
      source: basename(fileArg),
      status: result.errors.length > 0 ? "PARTIAL" : "SUCCESS",
      offersFound: rows.length,
      recordsCreated: result.created,
      recordsUpdated: result.updated,
      recordsUnchanged: result.unchanged,
      recordsFailed: result.errors.length,
      errorCode: result.errors.length > 0 ? "INVALID_DATA" : null,
      error:
        result.errors.length > 0
          ? result.errors.slice(0, 10).join(" | ")
          : null,
    });
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

