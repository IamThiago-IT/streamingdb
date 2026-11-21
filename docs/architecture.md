# Arquitetura

## Visão geral

O StreamingDB é uma aplicação **Next.js App Router** com renderização no
servidor. As páginas leem o banco diretamente por funções em `lib/queries.ts`
(Prisma), sem uma camada de API intermediária. As rotas em `app/api/` existem
para consumo externo e para o Better Auth.

```text
Navegador
   │
   ▼
proxy.ts ──────────────► idioma, cookie de país e checagem otimista de sessão
   │
   ▼
app/[lang]/page.tsx (Server Component)
   │  getDictionary(lang)          textos
   │  getSelectedCountry()         cookie sdb_country
   ▼
lib/queries.ts ──► lib/db.ts ──► Prisma Client ──► Postgres/Neon ou SQLite
   │
   ▼
Componentes (Server/Client) → HTML + hidratação
```

## Stack

| Camada | Tecnologia | Onde |
|---|---|---|
| Framework | Next.js 16.2 (App Router, Turbopack) | `app/`, `next.config.ts` |
| UI | React 19, Tailwind CSS 4 | `app/`, `components/` |
| Tipagem | TypeScript 5 (strict) | `tsconfig.json` |
| Dados | Prisma 7 + driver adapters | `prisma/`, `lib/db*.ts` |
| Banco | Postgres/Neon (produção) ou SQLite (local) | `DATABASE_URL` |
| Autenticação | Better Auth + Prisma adapter | `lib/auth*.ts`, `app/api/auth` |
| i18n | Dicionários JSON + rota `/[lang]` | `dictionaries/`, `app/[lang]` |
| Gráficos | Recharts | `components/PriceHistoryChart.tsx` |
| Coleta | Cheerio + scripts Node | `scripts/` |
| Analytics | Vercel Analytics | `app/[lang]/layout.tsx` |

## Estrutura de pastas

```text
app/
├── [lang]/                  # Segmento de idioma (pt-BR, en)
│   ├── layout.tsx           # Fontes, metadata, tema, analytics
│   ├── page.tsx             # Home: destaques, comparativo, mudanças
│   ├── platforms/           # Lista e detalhe de plataformas
│   ├── contents/            # Catálogo e detalhe de título
│   ├── compare/             # Comparador de até 3 plataformas
│   ├── changes/             # Log de mudanças com filtro
│   ├── login/ register/     # Formulários de autenticação
│   ├── profile/             # Conta e senha
│   ├── dictionaries.ts      # Carregamento dos dicionários
│   ├── ThemeProvider.tsx    # Tema claro/escuro no cliente
│   └── ThemeToggle.tsx
├── actions/country.ts       # Server action que grava o cookie de país
├── api/                     # Route handlers (ver docs/api.md)
├── generated/prisma/        # Client gerado pelo Prisma (fora do git)
├── globals.css              # Tokens de design (papel & tinta) e Tailwind
├── robots.ts / sitemap.ts   # Metadados de indexação
components/                  # Header, preço, logos, gráficos, auth
lib/
├── auth.ts                  # Configuração do Better Auth (servidor)
├── auth-client.ts           # Cliente do Better Auth
├── auth-providers.ts        # Detecção de credenciais sociais
├── countries.ts             # Países, moedas, bandeiras e helpers
├── country.ts               # País selecionado (cookie, server-only)
├── db.ts                    # PrismaClient singleton
├── db-adapter.ts            # Escolha do adapter Postgres/SQLite
├── db-filters.ts            # Busca case-insensitive por banco
├── locales.ts               # Locales suportados
├── money.ts                 # Formatação monetária e valor mensal
└── queries.ts               # Consultas de plataforma, catálogo e preços
prisma/
├── schema.prisma            # Modelo de dados
├── migrations/              # Migrations (Postgres)
└── seed.ts                  # Seed inicial
scripts/                     # Importação, validação, scraper, monitor
data/                        # CSV de ofertas e documentação do formato
dictionaries/                # Textos pt-BR.json e en.json
docs/                        # Documentação técnica
proxy.ts                     # Idioma, país e sessão (antigo middleware)
```

## Fluxo de uma requisição

1. **`proxy.ts`** intercepta tudo exceto `/api`, `_next` e metadados.
2. Sem prefixo de idioma, redireciona para `/{locale}` usando o
   `Accept-Language` (fallback `pt-BR`).
3. O cookie `sdb_country` é semeado na primeira visita a partir de
   `x-vercel-ip-country` (Vercel) ou do idioma; depois o usuário manda.
4. Rotas protegidas (`/profile`) são redirecionadas para login quando **não há
   cookie de sessão**. `/login` e `/register` redirecionam para a home quando o
   cookie existe. Essa checagem é apenas otimista.
5. A página (Server Component) valida o idioma, carrega o dicionário, lê o país
   e consulta o banco. Sessões são validadas de verdade com
   `auth.api.getSession()` na página/action.
6. Componentes client-side cuidam de tema, seletor de país, formulários e
   gráficos.

## Decisões de projeto

### Preço nativo, não moeda

`Plan` é o tier canônico da plataforma (`padrao`, `premium`, ...). O preço vive
em `PlanOffer`, por **país + ciclo**, com a moeda derivada do país. EUR na
Alemanha e em Portugal são ofertas distintas. Não há conversão cambial. Veja
[Preços e ofertas](pricing.md).

### Seed e coleta separados

O seed cria a estrutura mínima (plataformas, tiers e ofertas iniciais do
Brasil). Preços verificados depois entram pelo importador CSV ou scraper e
**não são sobrescritos** por uma nova execução do seed.

### Adapter por URL

`lib/db-adapter.ts` escolhe o driver em tempo de execução pelo prefixo de
`DATABASE_URL`. Isso permite desenvolvimento em SQLite e produção em
Postgres/Neon com o mesmo schema Prisma.

### Busca compatível com os dois bancos

`lib/db-filters.ts` só envia `mode: "insensitive"` no Postgres; no SQLite o
`LIKE` já ignora caixa para ASCII. Use `containsInsensitive()` em novas
consultas de texto.

### i18n por rota

O idioma faz parte da URL (`/pt-BR/...`, `/en/...`), o que gera links
compartilháveis e URLs previsíveis. Os textos ficam em
`dictionaries/{locale}.json`, tipados pelo carregador em
`app/[lang]/dictionaries.ts`.

## Onde alterar cada coisa

| Objetivo | Arquivo(s) |
|---|---|
| Nova página | `app/[lang]/<rota>/page.tsx` |
| Novo endpoint | `app/api/<rota>/route.ts` |
| Nova consulta de dados | `lib/queries.ts` |
| Novo país/moeda | `lib/countries.ts` |
| Novo texto de interface | `dictionaries/pt-BR.json` e `dictionaries/en.json` |
| Novo modelo/tabela | `prisma/schema.prisma` + migration |
| Novo plano/plataforma inicial | `prisma/seed.ts` |
| Nova fonte de preço | `scripts/scraper.ts` e `PriceSource` |
| Estilo/tokens | `app/globals.css` |
| Regras de idioma/país/sessão | `proxy.ts` |
| Configuração de login | `lib/auth.ts`, `lib/auth-providers.ts` |
