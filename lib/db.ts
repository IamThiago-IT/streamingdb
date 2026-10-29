import { PrismaClient } from "@/app/generated/prisma/client";
import { createPrismaAdapter } from "./db-adapter";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createPrismaAdapter() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
