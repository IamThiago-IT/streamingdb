# Autenticação

O projeto usa [Better Auth](https://www.better-auth.com/) com o adapter Prisma.
A configuração do servidor fica em `lib/auth.ts` e o cliente em
`lib/auth-client.ts`.

## Como está configurado

```ts
betterAuth({
  baseURL: {
    allowedHosts: ["localhost:3000", "localhost:3001", "*.vercel.app"],
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
    fallback: process.env.BETTER_AUTH_URL,
  },
  database: prismaAdapter(prisma, {
    provider: isPostgres ? "postgresql" : "sqlite",
  }),
  emailAndPassword: { enabled: true },
  socialProviders: { /* google e/ou github, se configurados */ },
  plugins: [nextCookies()],
});
```

- O provider do adapter é escolhido pelo prefixo de `DATABASE_URL`
  (`postgres*` → `postgresql`; caso contrário, `sqlite`).
- `nextCookies()` integra os cookies do Better Auth com as Server Actions do
  Next.js.
- Email/senha está sempre habilitado.
- Google e GitHub só entram em `socialProviders` quando **client ID e secret**
  estão definidos. Sem credenciais, o provedor não aparece na UI e a rota de
  callback não é registrada.

## Variáveis

| Variável | Uso |
|---|---|
| `BETTER_AUTH_SECRET` (ou `AUTH_SECRET`) | Assinatura de sessão. Obrigatória em produção. |
| `BETTER_AUTH_URL` | URL pública usada como fallback do `baseURL`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Login com Google. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Login com GitHub. |

Gere o segredo com:

```bash
npx @better-auth/cli secret
```

Em produção o Better Auth lança erro se nenhum segredo estiver definido — não
há fallback inseguro.

## Rotas e proteção

| Rota | Comportamento |
|---|---|
| `/{lang}/register` | Cria conta com nome, email e senha. |
| `/{lang}/login` | Login por email/senha e botões sociais habilitados. |
| `/{lang}/profile` | Página autenticada; exige sessão válida no servidor. |
| `/{lang}/profile` (ação) | `setPasswordAction` define senha para quem entrou por OAuth. |
| `/api/auth/[...all]` | Handler HTTP do Better Auth (`toNextJsHandler`). |

O `proxy.ts` faz apenas uma **checagem otimista** pela presença do cookie de
sessão:

- `/profile` sem cookie → redireciona para `/{lang}/login`.
- `/login` ou `/register` com cookie → redireciona para `/{lang}`.

A validação real acontece em cada página/action:

```ts
const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect(`/${lang}/login`);
```

## Fluxos

### Email e senha

O formulário em `components/auth/LoginForm.tsx` e `RegisterForm.tsx` usa
`authClient`. Após o login, o cookie de sessão é criado e o header passa a
mostrar o usuário via `authClient.useSession()`.

### Login social

1. `app/[lang]/login/page.tsx` lê `getEnabledSocialProviders()` no servidor.
2. `SocialAuthButtons` chama `authClient.signIn.social({ provider, callbackURL })`.
3. O Better Auth redireciona para o provedor e processa o retorno em
   `/api/auth/callback/{provider}`.
4. A conta é vinculada em `Account`; o usuário é criado em `User` se necessário.

Configure as URLs de callback no console do provedor:

```text
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/callback/github
```

Em produção, troque `localhost:3000` pelo domínio real.

### Usuários OAuth definindo senha

`app/[lang]/profile/page.tsx` verifica se existe uma conta com
`providerId = "credential"`. Se não existir, mostra "Definir senha" e chama
`auth.api.setPassword` pela server action. Assim, quem entrou por Google/GitHub
também pode acessar por email/senha depois.

## Adicionar um provedor social

1. Adicione o provedor em `lib/auth-providers.ts` (tipo, env e config).
2. Importe e inclua em `socialProviders` de `lib/auth.ts`.
3. Inclua o rótulo/ícone em `components/auth/SocialAuthButtons.tsx` se ele
   precisar aparecer na tela (o componente hoje suporta Google e GitHub).
4. Cadastre as credenciais e a URL de callback no provedor.
5. Teste login, logout e definição de senha no perfil.

## Boas práticas

- Nunca versione `.env`/`.env.local`; use `.env.example` como modelo.
- Defina `BETTER_AUTH_SECRET` forte em produção e mantenha `BETTER_AUTH_URL`
  coerente com o domínio.
- Não confie apenas no proxy: valide a sessão com `getSession()` em toda página
  ou action protegida.
- Ao restringir hosts, revise `baseURL.allowedHosts` em `lib/auth.ts`.
