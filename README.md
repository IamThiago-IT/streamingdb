# StreamingDB

Aplicação web para acompanhar **preços, catálogos e mudanças** das plataformas
de streaming. Os preços são nativos por país — sem conversão cambial — e cada
oferta guarda moeda, ciclo de cobrança, histórico e fonte da verificação.

## O que tem

- Comparativo de preços por país, com filtros de planos com/sem anúncios.
- Páginas de plataforma com planos, catálogo e histórico de preços.
- Catálogo de filmes e séries com disponibilidade por plataforma.
- Log de mudanças (preço, catálogo e planos) com filtro por tipo.
- Comparador de até três plataformas.
- Login com email/senha e, opcionalmente, Google e GitHub.
- Interface em **português (pt-BR)** e **inglês (en)**.
- Coleta de preços por CSV, scraper e monitor de variações.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router, Turbopack) + React 19
- TypeScript 5 e Tailwind CSS 4
- [Prisma 7](https://www.prisma.io/) com driver adapters (Postgres/Neon ou SQLite)
- [Better Auth](https://www.better-auth.com/) com adapter Prisma
- Recharts, Cheerio, Vercel Analytics

## Começando

Pré-requisitos: **Node.js 20+** e **pnpm**.

```bash
pnpm install
cp .env.example .env.local
pnpm db:push      # SQLite local: cria o schema a partir do Prisma
pnpm db:seed      # plataformas, planos e catálogo de exemplo
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000). Para usar Postgres/Neon,
configure `DATABASE_URL`/`DIRECT_URL` e rode `pnpm db:migrate` em vez de
`db:push`.

> O seed inicial cobre apenas o Brasil. Para adicionar outros países, importe
> ofertas com `pnpm seed:offers --file=data/offers.csv`.

## Documentação

A documentação completa está em [`docs/`](docs/README.md).

| Documento | Conteúdo |
|---|---|
| [Começando](docs/getting-started.md) | Instalação, variáveis de ambiente e banco |
| [Arquitetura](docs/architecture.md) | Estrutura, fluxo de requisição e decisões |
| [Banco de dados](docs/database.md) | Modelos, relações, migrations e seeds |
| [Preços e ofertas](docs/pricing.md) | Preço nativo, CSV, scraper e monitor |
| [API](docs/api.md) | Endpoints HTTP e respostas |
| [Internacionalização](docs/internationalization.md) | Idiomas, países e moeda |
| [Autenticação](docs/authentication.md) | Better Auth, provedores e sessão |
| [Deploy](docs/deployment.md) | Vercel + Neon e operação |
| [Docker](docs/docker.md) | Compose, imagem e produção |

## Comandos

```bash
pnpm dev              # desenvolvimento (Turbopack)
pnpm build            # generate + migrate deploy + build
pnpm start            # produção
pnpm lint             # ESLint

pnpm db:generate      # Prisma Client
pnpm db:migrate       # migrations (Postgres)
pnpm db:push          # sincroniza schema (SQLite)
pnpm db:seed          # seed inicial
pnpm db:studio        # Prisma Studio
pnpm db:reset         # reseta o banco (cuidado)

pnpm seed:offers --file=data/offers.csv   # importa ofertas (aceita --dry-run)
pnpm validate:offers                      # valida cobertura e consistência
pnpm scrape                               # coleta preços configurados
pnpm monitor                              # detecta variações de preço
pnpm seed:content                         # lote extra de catálogo
```

## Estrutura

```text
app/[lang]/      páginas por idioma (home, plataformas, catálogo, mudanças)
app/api/         route handlers (plataformas, planos, conteúdo, busca, auth)
components/      UI, preços, gráficos e autenticação
lib/             queries, Prisma, países, moeda, i18n e auth
prisma/          schema, migrations e seed
scripts/         importação, validação, scraper e migração
data/            CSV de ofertas e formato
dictionaries/    textos pt-BR e en
docs/            documentação
```

## Preço nativo

`Plan` é o tier canônico da plataforma; `PlanOffer` guarda o preço real por
**país + ciclo**, com a moeda derivada do país (`lib/countries.ts`). EUR na
Alemanha e em Portugal são ofertas distintas. O preço de site oficial é a
referência; App Store/Play entram com `sourceType` próprio. O histórico
pertence à oferta, não ao plano. Veja [Preços e ofertas](docs/pricing.md).

## Deploy

O caminho recomendado é **Vercel + Neon**; o build executa
`prisma generate && prisma migrate deploy && next build`. Configure
`DATABASE_URL` (pooled), `DIRECT_URL` (direta) e `BETTER_AUTH_SECRET`. Passo a
passo em [Deploy](docs/deployment.md). Para self-hosting, use
[Docker](docs/docker.md).

## Licença

MIT.
