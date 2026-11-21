# API

Todas as rotas são **Route Handlers** em `app/api/`. Não há autenticação nas
rotas públicas; `/api/auth/*` é tratada pelo Better Auth.

Base local: `http://localhost:3000`

## Resumo

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/platforms` | Plataformas com planos e ofertas do país. |
| `GET` | `/api/platforms/[slug]` | Detalhe de uma plataforma. |
| `GET` | `/api/plans` | Ofertas do país, ordenadas por valor mensal. |
| `GET` | `/api/contents` | Catálogo paginado com filtros. |
| `GET` | `/api/contents/[slug]` | Detalhe de um título. |
| `GET` | `/api/changes` | Log de mudanças paginado. |
| `GET` | `/api/search?q=` | Busca rápida em plataformas e títulos. |
| `GET` | `/api/health` | Health check da aplicação e do banco. |
| `*` | `/api/auth/[...all]` | Handler do Better Auth. |

## Parâmetros de país

As rotas de plataformas e planos aceitam `?country=XX`. O valor precisa estar
em `lib/countries.ts`; caso contrário, usa o padrão **BR**.

Países suportados: `BR`, `US`, `CA`, `GB`, `AU`, `MX`, `DE`, `PT`, `ES`, `JP`,
`IN`, `KR`.

## `GET /api/platforms`

Lista plataformas com planos, ofertas do país e contagem de conteúdos
disponíveis.

```bash
curl "http://localhost:3000/api/platforms?country=BR"
```

```json
{
  "country": "BR",
  "currency": "BRL",
  "platforms": [
    {
      "id": "...",
      "name": "Netflix",
      "slug": "netflix",
      "plans": [
        {
          "id": "...",
          "tierKey": "padrao",
          "name": "Padrão",
          "offers": [
            {
              "countryCode": "BR",
              "currency": "BRL",
              "amount": "44.9",
              "billingCycle": "MONTHLY",
              "billingMonths": 1,
              "ads": false,
              "quality": "HD",
              "status": "ACTIVE"
            }
          ]
        }
      ],
      "platformCountries": [{ "countryCode": "BR", "status": "OPERATES" }],
      "_count": { "availability": 8 }
    }
  ]
}
```

> `amount` é `Decimal` do Prisma e aparece como string no JSON.

## `GET /api/platforms/[slug]`

Detalhe da plataforma: planos, ofertas do país (com até 20 registros de
histórico), disponibilidade, até 50 conteúdos e até 20 mudanças.

```bash
curl "http://localhost:3000/api/platforms/netflix?country=BR"
```

Retorna `404` com `{ "error": "Platform not found" }` se o slug não existir.

## `GET /api/plans`

Ofertas `ACTIVE` e `STALE` do país, ordenadas pelo valor mensal equivalente
(`amount / billingMonths`). Inclui o último registro de histórico.

```bash
curl "http://localhost:3000/api/plans?country=BR"
```

```json
{
  "country": "BR",
  "currency": "BRL",
  "offers": [
    {
      "id": "...",
      "amount": "16.9",
      "currency": "BRL",
      "billingMonths": 1,
      "plan": {
        "name": "Plano Mensal",
        "platform": { "name": "Looke", "slug": "looke" }
      },
      "history": [{ "amount": "16.9", "recordedAt": "..." }]
    }
  ]
}
```

## `GET /api/contents`

Catálogo paginado.

| Parâmetro | Tipo | Padrão | Observação |
|---|---|---|---|
| `q` | string | — | Busca em `title` e `originalTitle` (case-insensitive). |
| `type` | string | — | Ex.: `MOVIE`, `SERIES`. |
| `platform` | string | — | Slug da plataforma. |
| `genre` | string | — | Busca parcial no gênero. |
| `page` | int | `1` | Mínimo 1. |
| `limit` | int | `20` | Máximo 50. |

```bash
curl "http://localhost:3000/api/contents?q=duna&type=MOVIE&page=1&limit=10"
```

```json
{
  "data": [
    {
      "id": "...",
      "title": "Duna: Parte 2",
      "slug": "duna-parte-2",
      "type": "MOVIE",
      "year": 2024,
      "availability": [
        { "available": true, "platform": { "name": "HBO Max", "slug": "hbo-max" } }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

## `GET /api/contents/[slug]`

Retorna o título com toda a disponibilidade e as 10 últimas mudanças. `404` se
não existir.

```bash
curl "http://localhost:3000/api/contents/duna-parte-2"
```

## `GET /api/changes`

Log de mudanças paginado, mais recente primeiro.

| Parâmetro | Tipo | Padrão | Observação |
|---|---|---|---|
| `type` | string | — | `PRICE_CHANGE`, `CONTENT_ADDED`, `CONTENT_REMOVED`, `NEW_PLATFORM`, `PLAN_CHANGE`. |
| `platform` | string | — | Slug da plataforma. |
| `country` | string | — | Quando válido, inclui mudanças do país **e** globais (`countryCode = null`). |
| `page` | int | `1` | Mínimo 1. |
| `limit` | int | `30` | Entre 1 e 100. |

```bash
curl "http://localhost:3000/api/changes?type=PRICE_CHANGE&country=BR&limit=10"
```

## `GET /api/search`

Busca rápida. Retorna listas vazias quando `q` tem menos de 2 caracteres.

```bash
curl "http://localhost:3000/api/search?q=net"
```

```json
{
  "platforms": [{ "id": "...", "name": "Netflix", "slug": "netflix" }],
  "contents": [
    {
      "title": "Stranger Things",
      "slug": "stranger-things",
      "availability": [{ "platform": { "name": "Netflix" } }]
    }
  ]
}
```

Limites: 5 plataformas e 10 títulos.

## `GET /api/health`

Verifica se a aplicação responde e se o banco aceita uma consulta simples.

```bash
curl -i "http://localhost:3000/api/health"
```

```json
{ "status": "ok" }
```

Retorna `503` com `{ "status": "unavailable" }` quando o banco não responde.
Usado pelo health check do Docker.

## `/api/auth/[...all]`

Handler do Better Auth (`toNextJsHandler`). Cobre login, registro, logout,
callback OAuth, sessão e demais endpoints do framework. Consulte
[Autenticação](authentication.md).

## Limitações atuais

- Não há versionamento, rate limiting nem chave de API nas rotas públicas.
- Erros de banco não são padronizados; apenas `platforms/[slug]` e
  `contents/[slug]` retornam `404` explícito.
- `robots.ts` desautoriza `/api/` para crawlers.
