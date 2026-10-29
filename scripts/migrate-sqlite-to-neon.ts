import "dotenv/config";
import Database from "better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Migra todos os dados do SQLite local (dev.db) para o Postgres (Neon).
 *
 * Uso:
 *   $env:TARGET_DATABASE_URL = "postgresql://..."; npx tsx scripts/migrate-sqlite-to-neon.ts
 *
 * Lê o SQLite com better-sqlite3 puro (o client Prisma gerado já é do provider
 * postgres e não aceita adapter SQLite) e grava no Neon via PrismaClient.
 * Preserva IDs e timestamps. Idempotente (skipDuplicates).
 */

const targetUrl = process.env.TARGET_DATABASE_URL;
if (!targetUrl?.startsWith("postgres")) {
  console.error(
    "Defina TARGET_DATABASE_URL com a connection string Postgres (Neon) antes de rodar."
  );
  process.exit(1);
}

const sourcePath = (process.env.SOURCE_DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const sqlite = new Database(sourcePath, {
  readonly: true,
});
const target = new PrismaClient({ adapter: new PrismaPg({ connectionString: targetUrl }) });

const d = (v: string | null) => (v == null ? null : new Date(v));
const b = (v: number | null) => (v == null ? null : v !== 0);

async function copy(
  label: string,
  sql: string,
  map: (r: Record<string, unknown>) => Record<string, unknown>,
  write: (rows: Record<string, unknown>[]) => Promise<unknown>
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
    (r) => ({ ...r, createdAt: d(r.createdAt as string), updatedAt: d(r.updatedAt as string) }),
    (rows) => target.platform.createMany({ data: rows, skipDuplicates: true })
  );

  counts.Plan = await copy(
    "Plan",
    "SELECT * FROM Plan",
    (r) => ({
      ...r,
      ads: b(r.ads as number),
      createdAt: d(r.createdAt as string),
      updatedAt: d(r.updatedAt as string),
    }),
    (rows) => target.plan.createMany({ data: rows, skipDuplicates: true })
  );

  counts.Content = await copy(
    "Content",
    "SELECT * FROM Content",
    (r) => ({ ...r, createdAt: d(r.createdAt as string), updatedAt: d(r.updatedAt as string) }),
    (rows) => target.content.createMany({ data: rows, skipDuplicates: true })
  );

  counts.ContentAvailability = await copy(
    "ContentAvailability",
    "SELECT * FROM ContentAvailability",
    (r) => ({
      ...r,
      available: b(r.available as number),
      addedAt: d(r.addedAt as string),
      removedAt: d(r.removedAt as string | null),
      updatedAt: d(r.updatedAt as string),
    }),
    (rows) => target.contentAvailability.createMany({ data: rows, skipDuplicates: true })
  );

  counts.PriceHistory = await copy(
    "PriceHistory",
    "SELECT * FROM PriceHistory",
    (r) => ({
      ...r,
      recordedAt: d(r.recordedAt as string),
      createdAt: d(r.createdAt as string),
    }),
    (rows) => target.priceHistory.createMany({ data: rows, skipDuplicates: true })
  );

  counts.ChangeLog = await copy(
    "ChangeLog",
    "SELECT * FROM ChangeLog",
    (r) => ({ ...r, createdAt: d(r.createdAt as string) }),
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
    (rows) => target.verification.createMany({ data: rows, skipDuplicates: true })
  );

  // Verificação: conta as linhas no destino e compara
  console.log("\n--- Verificação no destino (Neon) ---");
  const destCounts = {
    Platform: await target.platform.count(),
    Plan: await target.plan.count(),
    Content: await target.content.count(),
    ContentAvailability: await target.contentAvailability.count(),
    PriceHistory: await target.priceHistory.count(),
    ChangeLog: await target.changeLog.count(),
    User: await target.user.count(),
    Session: await target.session.count(),
    Account: await target.account.count(),
    Verification: await target.verification.count(),
  };

  let ok = true;
  for (const [model, expected] of Object.entries(counts)) {
    const actual = destCounts[model as keyof typeof destCounts];
    const status = actual === expected ? "OK" : "DIVERGE";
    if (actual !== expected) ok = false;
    console.log(`${model}: origem=${expected} destino=${actual} ${status}`);
  }
  console.log(ok ? "\nMigração concluída e verificada." : "\nMigração com divergências!");
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
