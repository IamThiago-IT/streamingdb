# Deploy

O caminho principal é **Vercel + Neon Postgres**. Docker é uma alternativa
para self-hosting e está documentado em [Docker](docker.md).

## Pré-requisitos

- Repositório no GitHub/GitLab/Bitbucket.
- Projeto Neon com um banco Postgres 16+.
- Conta na Vercel.

## 1. Preparar o Neon

1. Crie um projeto no Neon (a região ideal é próxima dos usuários).
2. Copie as duas connection strings:
   - **Pooled** (host com `-pooler`): use em `DATABASE_URL`.
   - **Direct** (sem pooling): use em `DIRECT_URL` para migrations.
3. Ambas precisam de `sslmode=require` quando não vierem no formato padrão.

O projeto usa o adapter `@prisma/adapter-pg` no runtime quando `DATABASE_URL`
começa com `postgres`.

## 2. Configurar a Vercel

Importe o repositório e mantenha o build padrão (`pnpm build`, definido no
`package.json`). O pipeline é:

```text
prisma generate → prisma migrate deploy → next build
```

> `prisma migrate deploy` roda durante o build e precisa de acesso ao banco.
> Se `DIRECT_URL` não estiver definida, o Prisma usa `DATABASE_URL`.

### Variáveis de ambiente

| Variável | Obrigatória | Observação |
|---|---|---|
| `DATABASE_URL` | sim | Connection string Postgres com pooling. |
| `DIRECT_URL` | recomendada | Connection string direta para migrations. |
| `BETTER_AUTH_SECRET` | sim | Segredo forte; sem ele o Better Auth falha em produção. |
| `BETTER_AUTH_URL` | sim | URL pública da aplicação (ex.: `https://streamingdb.app`). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | não | Login com Google. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | não | Login com GitHub. |

Cadastre as variáveis nos três ambientes (Production, Preview e Development)
conforme a necessidade. Para Preview, o ideal é usar **Neon branching** por
deploy, em vez de apontar todos os previews para o banco de produção.

### Login social em produção

No console do Google/GitHub, adicione as URLs de callback:

```text
https://<seu-dominio>/api/auth/callback/google
https://<seu-dominio>/api/auth/callback/github
```

`lib/auth.ts` aceita `localhost:3000`, `localhost:3001` e `*.vercel.app` como
hosts. Se usar domínio próprio, confirme que `BETTER_AUTH_URL` está correto e,
se necessário, ajuste `baseURL.allowedHosts`.

## 3. Primeiro deploy

1. Faça o deploy.
2. Rode as migrations (o build já executa `migrate deploy`, mas confira os
   logs).
3. Popule o banco, apontando para produção a partir da sua máquina:

```bash
# PowerShell
$env:DATABASE_URL="postgresql://...@host/banco?sslmode=require"
$env:DIRECT_URL="postgresql://...@host/banco?sslmode=require"

pnpm db:seed
pnpm seed:offers --file=data/offers.csv --dry-run
pnpm seed:offers --file=data/offers.csv
pnpm validate:offers
```

```bash
# bash/zsh
DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." pnpm db:seed
DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." pnpm seed:offers --file=data/offers.csv
```

> O seed só cria a estrutura inicial e ofertas do Brasil. A importação de CSV
> atualiza preços e gera histórico.

## 4. Verificações pós-deploy

- `GET /api/health` retorna `{ "status": "ok" }`.
- `/{lang}` abre no idioma esperado.
- Trocar o país no header muda a moeda e os valores.
- Login por email/senha funciona; se configurado, Google/GitHub também.
- `/{lang}/profile` exige sessão.

## Analytics

O layout inclui `@vercel/analytics`. Nenhuma configuração extra é necessária na
Vercel; em self-hosting, o componente simplesmente não envia dados.

## Domínio e SEO

`app/sitemap.ts` e `app/robots.ts` usam o domínio fixo
`https://streamingdb.app`. Ao publicar em outro domínio, atualize os dois
arquivos (e considere extrair a URL para uma variável de ambiente).

## Operação contínua

| Tarefa | Comando |
|---|---|
| Atualizar preços | `pnpm seed:offers --file=...` ou `pnpm scrape` |
| Detectar variações | `pnpm monitor` |
| Validar cobertura | `pnpm validate:offers` |
| Inspecionar o banco | `pnpm db:studio` |

Agende a coleta/importação em um cron externo (GitHub Actions, Vercel Cron ou
Neon) apontando para o banco de produção. O histórico e o `ChangeLog` são
gerados pelos próprios scripts.

## Rollback e migrations

- Migrations são versionadas em `prisma/migrations/` e aplicadas em ordem.
- Evite editar migrations já aplicadas; crie uma nova.
- Para reverter um deploy, faça rollback do código e avalie se a migration
  precisa de uma migration compensatória — o Prisma não gera down migrations.
- Faça backup/branch no Neon antes de mudanças de schema arriscadas.

## Docker

Para self-hosting com Docker Compose, consulte [Docker](docker.md). A imagem
usa `output: standalone` e aplica `prisma migrate deploy` no start do container.
