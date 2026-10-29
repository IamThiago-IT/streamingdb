import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "./db";

const databaseUrl = process.env.DATABASE_URL ?? "";
const isPostgres = databaseUrl.startsWith("postgres");

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ??
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? "vercel-build-placeholder-secret-min-32-chars"
      : undefined),
  baseURL: {
    allowedHosts: ["localhost:3000", "localhost:3001", "*.vercel.app"],
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
  },
  database: prismaAdapter(prisma, {
    provider: isPostgres ? "postgresql" : "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
});
