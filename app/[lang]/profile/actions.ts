"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Define a senha de usuários que entraram por OAuth (Google/GitHub) e ainda
 * não têm senha. Só pode ser chamado do servidor, conforme a API do Better Auth.
 */
export async function setPasswordAction(newPassword: string): Promise<void> {
  await auth.api.setPassword({
    body: { newPassword },
    headers: await headers(),
  });
}
