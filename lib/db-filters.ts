/**
 * Filtros de texto que funcionam tanto no Postgres (produção) quanto no SQLite
 * local. No Postgres o `contains` do Prisma é case-sensitive; no SQLite o LIKE
 * já ignora maiúsculas/minúsculas para ASCII, então o `mode` não é enviado.
 */
const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");

export function containsInsensitive(value: string) {
  return isPostgres
    ? { contains: value, mode: "insensitive" as const }
    : { contains: value };
}
