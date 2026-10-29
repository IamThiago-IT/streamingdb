import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Escolhe o adapter do Prisma conforme o scheme de DATABASE_URL:
 * - `postgres://` / `postgresql://` → Postgres (produção na Vercel + Neon)
 * - `file:` (ou ausente) → SQLite local via better-sqlite3
 *
 * Usado por lib/db.ts, prisma/seed.ts e os scripts em scripts/.
 */
export function createPrismaAdapter() {
  const url = process.env.DATABASE_URL ?? "";

  if (url.startsWith("postgres")) {
    return new PrismaPg({ connectionString: url });
  }

  const sqliteUrl = url.startsWith("file:") ? url : "file:./dev.db";
  return new PrismaBetterSqlite3({ url: sqliteUrl });
}
