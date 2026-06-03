import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
});
