# Documentação do StreamingDB

O StreamingDB acompanha preços, catálogos e mudanças das plataformas de
streaming. O preço é **nativo por país** (sem conversão cambial) e cada oferta
guarda a moeda, o ciclo de cobrança e a fonte da verificação.

## Índice

| Documento | Para que serve |
|---|---|
| [Começando](getting-started.md) | Instalar, configurar o banco e rodar o projeto |
| [Arquitetura](architecture.md) | Stack, estrutura de pastas e fluxo de uma requisição |
| [Banco de dados](database.md) | Modelos Prisma, relações, migrations e seeds |
| [Preços e ofertas](pricing.md) | Regras de preço nativo, importação de CSV, coleta e monitoramento |
| [API](api.md) | Rotas HTTP públicas e formato das respostas |
| [Internacionalização](internationalization.md) | Idiomas, dicionários, seleção de país e formatação de moeda |
| [Autenticação](authentication.md) | Better Auth, login social, sessão e perfil |
| [Deploy](deployment.md) | Vercel + Neon, variáveis e pipeline de build |
| [Docker](docker.md) | Desenvolvimento e produção com Docker Compose |

## Visão rápida

- **Framework:** Next.js 16 (App Router, Turbopack) com React 19 e TypeScript.
- **Estilo:** Tailwind CSS 4 e componentes locais em `components/`.
- **Banco:** Prisma 7 com driver adapters — Postgres/Neon em produção e SQLite
  local para desenvolvimento.
- **Autenticação:** Better Auth com email/senha e, opcionalmente, Google/GitHub.
- **Idiomas:** `pt-BR` e `en`, com rotas prefixadas por idioma.
- **Países:** 12 moedas nativas definidas em `lib/countries.ts`; a seleção fica
  no cookie `sdb_country`.
- **Conteúdo:** plataformas, planos, ofertas, histórico de preço, catálogo e
  log de mudanças.
- **Operação:** importação de ofertas por CSV, validação de cobertura, scraper
  e monitor de mudanças.

## Mapa do repositório

```text
streamingdb/
├── app/                    # Rotas, páginas server-side e API (App Router)
│   ├── [lang]/             # Páginas por idioma
│   ├── actions/            # Server actions (país)
│   ├── api/                # Route handlers HTTP
│   └── generated/prisma/   # Client Prisma gerado (ignorado no git)
├── components/             # Componentes de UI (header, preços, gráficos, auth)
├── data/                   # CSV de ofertas e referência do formato
├── dictionaries/           # Textos pt-BR e en
├── docs/                   # Esta documentação
├── lib/                    # Acesso a dados, países, moeda, auth e queries
├── prisma/                 # Schema, migrations e seed
├── public/                 # Arquivos estáticos
├── scripts/                # Importação, validação, scraper e migração
├── proxy.ts                # Roteamento por idioma, país e sessão
├── next.config.ts          # Configuração do Next.js
├── prisma.config.ts        # URL de migrations (DIRECT_URL/DATABASE_URL)
└── docker-compose.yml      # Postgres + aplicação
```

## Convenções da documentação

- Os documentos são escritos em português; nomes de modelos, campos, rotas e
  variáveis permanecem em inglês.
- Ao mudar comportamento, comandos ou variáveis de ambiente, atualize o
  documento correspondente e, se necessário, o `README.md` da raiz.
- O [README raiz](../README.md) é a porta de entrada; esta pasta concentra o
  detalhamento.
