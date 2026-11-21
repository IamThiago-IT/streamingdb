# Preços e ofertas

## Princípio: preço nativo por país

O preço é **nativo**: cada país tem sua moeda e seus valores reais, sem
conversão cambial. EUR na Alemanha e EUR em Portugal representam ofertas
distintas porque os catálogos e preços praticados são distintos.

- O país é escolhido no header; a seleção fica no cookie `sdb_country`.
- A moeda esperada vem de `lib/countries.ts`.
- `Plan` é o tier canônico da plataforma.
- `PlanOffer` guarda o valor, a moeda, o ciclo, os impostos e a fonte.
- `PriceHistory` pertence à oferta, não ao plano.
- Preço de site oficial é a referência. App Store/Play entram com
  `sourceType` próprio (`IOS`/`ANDROID`) e não competem no ranking principal.

## Modelo

```text
Platform
  └── Plan (tierKey: padrao | premium | com-anuncios | ...)
        └── PlanOffer (countryCode + billingCycle)
              └── PriceHistory (amount, currency, recordedAt)
```

Campos relevantes de `PlanOffer`:

| Campo | Uso |
|---|---|
| `countryCode` | ISO 3166-1 alpha-2; precisa existir em `lib/countries.ts`. |
| `currency` | ISO 4217; precisa ser a moeda do país. |
| `amount` | Valor no ciclo informado. |
| `billingCycle` | `MONTHLY`, `ANNUAL` ou `QUARTERLY`. |
| `billingMonths` | 1, 12 ou 3 (usado para comparar valor mensal). |
| `taxIncluded` | `true`, `false` ou desconhecido. |
| `quality` | Ex.: `HD`, `4K HDR`. |
| `ads` | Se o plano inclui anúncios. |
| `sourceUrl` / `sourceType` | Página e tipo da verificação. |
| `status` | `ACTIVE`, `STALE` ou `PENDING`. |
| `lastCheckedAt` / `lastSuccessAt` | Última tentativa e última verificação bem-sucedida. |

O schema completo e as relações estão em [Banco de dados](database.md).

## Importação por CSV

O formato detalhado (colunas obrigatórias, exemplos e regras de coleta) fica em
[`data/README.md`](../data/README.md). Resumo do fluxo:

```bash
# 1. Veja o que seria importado
pnpm seed:offers --file=data/offers.example.csv --dry-run

# 2. Importe de verdade
pnpm seed:offers --file=data/offers.example.csv

# 3. Valide cobertura e consistência
pnpm validate:offers
```

O importador (`scripts/import-offers.ts`):

- Valida país, moeda do país, valor, ciclo e `verified_at`.
- Encontra a plataforma por `platform_slug` e o plano por
  `(platformId, tier_key)`.
- Cria o plano se ele ainda não existir.
- Atualiza a oferta existente ou cria uma nova.
- Grava `PriceHistory` e `ChangeLog` **somente** quando o valor ou a moeda
  muda (ou quando a oferta ainda não tem histórico).
- Marca `PlatformCountry.status = "OPERATES"` para o par plataforma/país.
- É idempotente: rodar o mesmo CSV de novo não duplica dados.

O arquivo de exemplo (`data/offers.example.csv`) cobre Looke, Netflix e MUBI no
Brasil.

## Validação

```bash
pnpm validate:offers
```

O script (`scripts/validate-offers.ts`) imprime:

- Matriz **plataforma × país** com a quantidade de ofertas.
- Fontes de preço ativas (`PriceSource`).
- Erros estruturais: país desconhecido, moeda diferente da moeda do país,
  valor inválido, ciclo/status inválido, plataforma marcada como
  `NOT_AVAILABLE` mas com oferta.
- Avisos: `tierKey` vazio, `billingMonths` incoerente com o ciclo, verificação
  com mais de 7 dias, plataforma que opera sem oferta coletada.

Legenda da matriz: número = ofertas; `—` = não disponível; `?` = não
coletado; `0` = opera sem oferta.

## Coleta automatizada (scraper)

```bash
pnpm scrape
```

O scraper em `scripts/scraper.ts` usa `fetch` + Cheerio. Hoje há uma configuração
para a Looke (Brasil, BRL, mensal). Para cada plano encontrado:

- Reaproveita o plano por `tierKey` ou nome.
- Cria a oferta se não existir.
- Se o preço mudou mais de R$ 0,01, grava `PriceHistory`, atualiza a oferta e
  cria um `ChangeLog` do tipo `PRICE_CHANGE`.
- Se não mudou, apenas atualiza `lastCheckedAt`/`lastSuccessAt`.

Para adicionar uma plataforma, inclua uma entrada em `scrapers` com `slug`,
país, moeda, URL e seletores, e cadastre/valide o seletor na página real. O
modelo `PriceSource` também permite registrar a configuração no banco
(atualmente o seed cria a fonte da Looke).

> Scrapers quebram quando o HTML muda. O `ScrapeRun` existe para auditar cada
> tentativa (`status`, `httpStatus`, `offersFound`, `error`), mas o script atual
> ainda não grava nele — use-o ao evoluir a coleta.

## Monitor de mudanças

```bash
pnpm monitor
```

O monitor compara os dois últimos registros de `PriceHistory` de cada oferta e,
quando a diferença é maior que R$ 0,01, imprime a variação e cria um
`ChangeLog` (uma vez por plataforma/país a cada 24h). Ele não altera a oferta:
o preço vigente já é atualizado pelo importador/scraper.

## Adicionar um país

1. Inclua o país e a moeda em `lib/countries.ts`.
2. Crie ofertas com `pnpm seed:offers` (CSV) ou via scraper.
3. Garanta que `PlatformCountry` reflita a realidade (`OPERATES`,
   `NOT_AVAILABLE` ou `UNKNOWN`).
4. Rode `pnpm validate:offers` e confira a matriz.
5. Se o país tiver um novo idioma, veja
   [Internacionalização](internationalization.md).

## Adicionar um plano/tier

- Use um `tier_key` estável e reutilizável entre países (ex.: `padrao`,
  `premium`, `com-anuncios`).
- O nome exibido (`display_name`) pode variar por país e idioma.
- Planos novos entram pelo CSV; não é necessário alterar o seed.
