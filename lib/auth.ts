import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "./db";
import { getSocialProviderConfig } from "./auth-providers";

const databaseUrl = process.env.DATABASE_URL ?? "";
const isPostgres = databaseUrl.startsWith("postgres");

const google = getSocialProviderConfig("google");
const github = getSocialProviderConfig("github");

export const auth = betterAuth({
  // Segredo vem de BETTER_AUTH_SECRET / AUTH_SECRET. Em produção o Better Auth
  // lança erro se nenhuma estiver definida — de propósito não há fallback.
  baseURL: {
    allowedHosts: ["localhost:3000", "localhost:3001", "*.vercel.app"],
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
    fallback: process.env.BETTER_AUTH_URL,
  },
  database: prismaAdapter(prisma, {
    provider: isPostgres ? "postgresql" : "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    ...(google ? { google } : {}),
    ...(github ? { github } : {}),
  },
  plugins: [nextCookies()],
});
