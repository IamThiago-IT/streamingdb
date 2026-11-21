# Internacionalização e país

O projeto trabalha com duas dimensões independentes:

- **Idioma** da interface: `pt-BR` e `en`.
- **País** dos preços: 12 países, cada um com sua moeda nativa.

Um usuário pode ler em inglês e ver preços do Brasil, por exemplo.

## Idiomas

Definidos em `lib/locales.ts`:

```ts
export const locales = ["pt-BR", "en"] as const;
export const defaultLocale = "pt-BR";
```

- O idioma faz parte da URL: `/{lang}/...` (ex.: `/pt-BR/platforms`).
- `app/[lang]/layout.tsx` valida o idioma com `hasLocale()` e retorna `404`
  para valores inválidos.
- `generateStaticParams()` gera `en` e `pt-BR`.
- Os textos ficam em `dictionaries/pt-BR.json` e `dictionaries/en.json`, com os
  mesmos grupos: `home`, `nav`, `country`, `pricing`, `platforms`, `platform`,
  `contents`, `content`, `changes`.
- `app/[lang]/dictionaries.ts` carrega o JSON sob demanda e expõe
  `getDictionary(locale)` e `hasLocale`.

### Uso em uma página

```tsx
const { lang } = await params;
if (!hasLocale(lang)) notFound();

const dict = await getDictionary(lang);
// dict.home.title, dict.pricing.month, ...
```

## Roteamento por idioma

`proxy.ts` intercepta todas as rotas, exceto `/api`, `_next` e arquivos com
extensão (favicon, sitemap, robots). Para caminhos sem prefixo:

1. Lê `Accept-Language`, ordena por peso (`q=`) e escolhe `pt-BR` para `pt*`,
   `en` para `en*`.
2. Redireciona para `/{locale}` preservando o restante do caminho.
3. Define `Vary: Accept-Language` na resposta.
4. Semeia o cookie de país.

O matcher não inclui `/api`, `_next`, `favicon.ico`, `icon.png`, `sitemap.xml`
e `robots.txt`.

## País

Definido em `lib/countries.ts`:

| País | Moeda | País | Moeda |
|---|---|---|---|
| BR | BRL | DE | EUR |
| US | USD | PT | EUR |
| CA | CAD | ES | EUR |
| GB | GBP | JP | JPY |
| AU | AUD | IN | INR |
| MX | MXN | KR | KRW |

O padrão é `BR`. O cookie é `sdb_country` (`COUNTRY_COOKIE`).

### Como o país é escolhido

1. **Primeira visita:** `proxy.ts` usa `x-vercel-ip-country` (geolocalização da
   Vercel) quando for um país suportado; senão, cai para `countryForLocale`
   (`pt-BR` → BR, demais → US).
2. **Cookie existente:** o proxy não sobrescreve. A escolha do usuário manda.
3. **Troca no header:** `components/CountrySelector.tsx` chama a server action
   `setCountryAction`, que grava o cookie por 1 ano (`path=/`, `sameSite=lax`) e
   atualiza a página.
4. **Leitura no servidor:** `lib/country.ts` valida o cookie com `isCountry()` e
   retorna `defaultCountry` se estiver ausente ou inválido.

Como o preço não é convertido, trocar de país troca também a moeda e os valores
exibidos — sempre vindos de `PlanOffer` daquele país.

### Helpers

```ts
getCountryName("DE", "pt-BR"); // "Alemanha" via Intl.DisplayNames
getCountryFlag("DE");          // 🇩🇪
getCountryCurrency("DE");      // "EUR"
countryForLocale("pt-BR");     // "BR"
```

## Formatação de moeda

`lib/money.ts` centraliza a apresentação:

- `formatMoney(amount, currency, locale)` usa `Intl.NumberFormat` com
  `style: "currency"` — resolve símbolo, separadores e moedas sem centavos
  (JPY/KRW).
- `currencySymbol()` retorna o símbolo compacto para ícones e marcadores.
- `monthlyAmount(amount, billingMonths)` divide o valor pelo número de meses
  para comparar planos mensais e anuais.

```ts
formatMoney(44.9, "BRL", "pt-BR");          // "R$ 44,90"
formatMoney(289.9, "BRL", "pt-BR");         // "R$ 289,90"
monthlyAmount(289.9, 12);                   // 24.1583...
```

## Textos ainda hardcoded

Algumas telas misturam dicionário e texto fixo em português — por exemplo, a
página de comparação, a seção "Comparação de preços" da home e a página de
perfil. Ao internacionalizar uma tela, mova os textos para os dois JSONs e use
`dict.*`.

## Adicionar um idioma

1. Adicione o locale em `lib/locales.ts`.
2. Crie `dictionaries/<locale>.json` com as mesmas chaves de `en.json`.
3. Registre o carregador em `app/[lang]/dictionaries.ts` (o mapa é tipado pelo
   locale).
4. Inclua o locale em `generateStaticParams()` de `app/[lang]/layout.tsx`.
5. Ajuste `getLocale()` em `proxy.ts` para reconhecer o novo
   `Accept-Language`.
6. Verifique `countryForLocale()` e, se necessário, `getCountryName()`.
7. O `sitemap.ts` usa `locales` automaticamente.

> O layout usa as fontes `Newsreader`, `Public Sans` e `IBM Plex Mono` com
> subset latino. Idiomas com outros alfabetos exigem ajuste de fontes.
