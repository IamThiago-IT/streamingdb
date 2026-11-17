# Ofertas de preço nativo

Cada linha é uma oferta real de um plano em um país. A moeda é derivada do
país (`lib/countries.ts`); não existe conversão cambial.

## Importar

```bash
pnpm seed:offers --file=data/offers.example.csv --dry-run
pnpm seed:offers --file=data/offers.example.csv
```

O importador é idempotente: ofertas existentes são atualizadas e só geram
`PriceHistory` + `ChangeLog` quando o valor (ou a moeda) muda.

## Colunas

| Coluna | Obrigatória | Observação |
|---|---|---|
| `platform_slug` | sim | slug de `Platform` (ex.: `netflix`) |
| `country_code` | sim | ISO 3166-1 alpha-2, precisa existir em `lib/countries.ts` |
| `tier_key` | sim | tier canônico por plataforma (ex.: `standard`, `premium`, `com-anuncios`) |
| `display_name` | sim | nome local do plano (ex.: `Standard with ads`) |
| `currency` | sim | ISO 4217; precisa ser a moeda do país |
| `amount` | sim | valor no ciclo informado; aceita `44.90` ou `44,90` |
| `billing_cycle` | sim | `MONTHLY`, `ANNUAL` ou `QUARTERLY` |
| `billing_months` | sim | 1, 12 ou 3 |
| `tax_included` | sim | `true`, `false` ou vazio (desconhecido) |
| `quality` | não | ex.: `HD`, `4K HDR` |
| `ads` | sim | `true`/`false` |
| `source_url` | sim | página oficial de onde o preço foi verificado |
| `source_type` | sim | `OFFICIAL_WEB`, `HELP_CENTER`, `IOS`, `ANDROID` ou `MANUAL` |
| `verified_at` | sim | data da verificação (`YYYY-MM-DD`) |

## Regras

- **Preço de web é a referência.** Preço de App Store/Play (`IOS`/`ANDROID`)
  entra com `source_type` próprio e não deve competir no ranking principal.
- Toda oferta precisa de `source_url` e `verified_at`.
- Não preencher preço de país onde a plataforma não opera. Use
  `PlatformCountry.status = NOT_AVAILABLE`.
- Preço nativo não é conversão: não derive um valor de outro país.

## Validar

```bash
pnpm validate:offers
```

Mostra a matriz plataforma × país, ofertas sem verificação recente e
inconsistências de moeda/ciclo.
