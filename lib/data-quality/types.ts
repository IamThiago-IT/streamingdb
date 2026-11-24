import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Tipos estruturais mínimos para a camada de qualidade. Os testes de
 * integração usam um Prisma Client gerado para SQLite; ele é estruturalmente
 * compatível e pode ser convertido para estes tipos na borda do teste.
 */
export type AuditDb = Pick<Prisma.TransactionClient, "changeLog">;
export type DataSourceDb = Pick<Prisma.TransactionClient, "dataSource">;
export type IssueDb = Pick<Prisma.TransactionClient, "dataQualityIssue">;
export type ReadDb = Prisma.TransactionClient;
export type WriteDb = Prisma.TransactionClient;
