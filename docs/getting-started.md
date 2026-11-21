# Começando

## Pré-requisitos

- **Node.js 20+** (o Dockerfile usa `node:20-alpine`).
- **pnpm** (recomendado; os comandos abaixo usam pnpm).
- **Postgres 16+** ou **Neon** para produção. Para desenvolvimento, o SQLite
  local funciona sem instalar nada.

## Instalação

```bash
git clone <seu-repositorio>
cd streamingdb
pnpm install
```

O `postinstall` executa `prisma generate` e cria o client em
`app/generated/prisma/` (pasta ignorada pelo git).

## Variáveis de ambiente

Copie o modelo e ajuste os valores:

```bash
cp .env.example .env.local
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | `file:./dev.db` para SQLite local ou connection string Postgres (com pooling, no Neon) para runtime. |
| `DIRECT_URL` | não | URL sem pooling usada por `prisma migrate`/`prisma db push`. Se ausente, usa `DATABASE_URL`. |
| `BETTER_AUTH_SECRET` | em produção | Segredo de assinatura de sessão. Gere com `npx @better-auth/cli secret`. |
| `BETTER_AUTH_URL` | não | URL pública da aplicação (ex.: `https://streamingdb.app`). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | não | Habilitam login com Google. Sem ambos, o provedor fica desativado. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | não | Habilitam login com GitHub. Sem ambos, o provedor fica desativado. |

> O Better Auth não define segredo padrão em produção: a aplicação falha de
> propósito se `BETTER_AUTH_SECRET`/`AUTH_SECRET` não existir.

## Escolha do banco

O adapter é escolhido pelo prefixo de `DATABASE_URL` em `lib/db-adapter.ts`:

- `postgres://` ou `postgresql://` → adapter Postgres (`@prisma/adapter-pg`).
- `file:` (ou variável ausente) → SQLite local (`better-sqlite3`, em `dev.db`).

### Opção A — SQLite local (mais simples)

```bash
# .env.local
DATABASE_URL="file:./dev.db"
```

As migrations em `prisma/migrations/` são travadas para Postgres
(`migration_lock.toml`). No SQLite, crie o schema com `db:push`:

```bash
pnpm db:push
pnpm db:seed
pnpm dev
```

### Opção B — Postgres/Neon

```bash
# .env.local
DATABASE_URL="postgresql://usuario:senha@host/banco?sslmode=require"
DIRECT_URL="postgresql://usuario:senha@host/banco?sslmode=require"
```

```bash
pnpm db:migrate    # prisma migrate dev
pnpm db:seed
pnpm dev
```

No Neon, use a URL **com pooling** em `DATABASE_URL` e a URL **direta** em
`DIRECT_URL` para migrations.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento com Turbopack em `http://localhost:3000`. |
| `pnpm build` | Gera o client, roda `prisma migrate deploy` e compila o Next.js. |
| `pnpm start` | Sobe o build de produção. |
| `pnpm lint` | Executa o ESLint. |
| `pnpm db:generate` | Gera o Prisma Client. |
| `pnpm db:migrate` | Cria/aplica migrations em desenvolvimento. |
| `pnpm db:push` | Sincroniza o schema sem criar migration (útil no SQLite). |
| `pnpm db:seed` | Popula plataformas, planos, ofertas do Brasil e catálogo de exemplo. |
| `pnpm db:studio` | Abre o Prisma Studio. |
| `pnpm db:reset` | Reseta o banco e reaplica migrations (`--force`). |
| `pnpm seed:offers --file=...` | Importa ofertas de um CSV (aceita `--dry-run`). |
| `pnpm validate:offers` | Valida cobertura, moedas e consistência das ofertas. |
| `pnpm scrape` | Executa os scrapers configurados em `scripts/scraper.ts`. |
| `pnpm monitor` | Detecta variações de preço pelo histórico e registra mudanças. |
| `pnpm seed:content` | Adiciona um lote extra de títulos ao catálogo. |

> `pnpm build` executa `prisma migrate deploy`. Em um ambiente SQLite local sem
> Postgres isso tende a falhar, porque as migrations são de Postgres. Para
> validar o build localmente, use um banco Postgres ou rode `pnpm next build`
> diretamente após `pnpm db:generate`.

## Primeiro acesso

1. Abra `http://localhost:3000`; o proxy redireciona para `/{lang}` conforme o
   `Accept-Language` e semeia o cookie de país.
2. Escolha o país no header para ver os preços daquela moeda.
3. Crie uma conta em `/{lang}/register` ou entre com Google/GitHub, se
   configurados.

## Problemas comuns

- **`DATABASE_URL` ausente:** o projeto cai em SQLite `file:./dev.db`, mas o
  arquivo precisa existir/ser criado com `pnpm db:push`.
- **Login social não aparece:** faltam `*_CLIENT_ID` e `*_CLIENT_SECRET`; os
  provedores são habilitados apenas quando o par está completo.
- **Sessão inválida em produção:** defina `BETTER_AUTH_SECRET` e
  `BETTER_AUTH_URL`.
- **Preços vazios para um país:** o seed inicial só cobre o Brasil. Importe
  ofertas com `pnpm seed:offers` — veja [Preços e ofertas](pricing.md).
