-- Preço nativo por país: Plan vira tier canônico; preço/histórico passam
-- para PlanOffer/PriceHistory. A migração preserva os dados existentes,
-- tratando-os como ofertas do Brasil em BRL.

-- CreateTable
CREATE TABLE "PlanOffer" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "billingMonths" INTEGER NOT NULL DEFAULT 1,
    "taxIncluded" BOOLEAN,
    "displayName" TEXT,
    "quality" TEXT,
    "ads" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSource" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "parserKey" TEXT NOT NULL,
    "renderMode" TEXT NOT NULL DEFAULT 'HTTP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "offersFound" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCountry" (
    "platformId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCountry_pkey" PRIMARY KEY ("platformId","countryCode")
);

-- AlterTable: Plan ganha o tier canônico (nullable para permitir backfill)
ALTER TABLE "Plan" ADD COLUMN "tierKey" TEXT;

-- Backfill: "Padrão com Anúncios" -> "padrao-com-anuncios"
UPDATE "Plan"
SET "tierKey" = trim(both '-' from regexp_replace(
    lower(translate(
        "name",
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )),
    '[^a-z0-9]+',
    '-',
    'g'
));

-- Nome sem caractere alfanumérico vira o próprio id.
UPDATE "Plan"
SET "tierKey" = "id"
WHERE "tierKey" IS NULL OR "tierKey" = '';

-- Evita colisão de tierKey dentro da mesma plataforma.
UPDATE "Plan" p
SET "tierKey" = p."tierKey" || '-' || p."id"
WHERE p."id" IN (
    SELECT "id"
    FROM (
        SELECT
            "id",
            row_number() OVER (
                PARTITION BY "platformId", "tierKey"
                ORDER BY "createdAt", "id"
            ) AS rn
        FROM "Plan"
    ) ranked
    WHERE rn > 1
);

-- Backfill: cada plano existente vira uma oferta do Brasil em BRL.
INSERT INTO "PlanOffer" (
    "id",
    "planId",
    "countryCode",
    "currency",
    "amount",
    "billingCycle",
    "billingMonths",
    "taxIncluded",
    "displayName",
    "quality",
    "ads",
    "sourceUrl",
    "sourceType",
    "status",
    "lastCheckedAt",
    "lastSuccessAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'br-' || "id",
    "id",
    'BR',
    'BRL',
    "price",
    CASE WHEN lower("billingCycle") = 'anual' THEN 'ANNUAL' ELSE 'MONTHLY' END,
    CASE WHEN lower("billingCycle") = 'anual' THEN 12 ELSE 1 END,
    TRUE,
    "name",
    "quality",
    "ads",
    NULL,
    'LEGACY',
    'ACTIVE',
    NOW(),
    NOW(),
    NOW(),
    NOW()
FROM "Plan";

-- PriceHistory passa a apontar para a oferta.
ALTER TABLE "PriceHistory" ADD COLUMN "offerId" TEXT;
ALTER TABLE "PriceHistory" ADD COLUMN "amount" DECIMAL(65,30);
ALTER TABLE "PriceHistory" ADD COLUMN "currency" TEXT;
ALTER TABLE "PriceHistory" ADD COLUMN "taxIncluded" BOOLEAN;

UPDATE "PriceHistory"
SET
    "offerId" = 'br-' || "planId",
    "amount" = "price",
    "currency" = 'BRL',
    "taxIncluded" = TRUE;

ALTER TABLE "PriceHistory" ALTER COLUMN "offerId" SET NOT NULL;
ALTER TABLE "PriceHistory" ALTER COLUMN "amount" SET NOT NULL;
ALTER TABLE "PriceHistory" ALTER COLUMN "currency" SET NOT NULL;

ALTER TABLE "PriceHistory" DROP CONSTRAINT "PriceHistory_planId_fkey";
ALTER TABLE "PriceHistory" DROP COLUMN "planId";
ALTER TABLE "PriceHistory" DROP COLUMN "price";

-- Plan não guarda mais preço/atributos de oferta.
ALTER TABLE "Plan"
DROP COLUMN "ads",
DROP COLUMN "billingCycle",
DROP COLUMN "price",
DROP COLUMN "quality";

-- ChangeLog ganha contexto de país/moeda.
ALTER TABLE "ChangeLog" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "ChangeLog" ADD COLUMN "currency" TEXT;

UPDATE "ChangeLog"
SET "countryCode" = 'BR', "currency" = 'BRL'
WHERE "type" = 'PRICE_CHANGE' AND "countryCode" IS NULL;

-- CreateIndex
CREATE INDEX "PlanOffer_countryCode_status_idx" ON "PlanOffer"("countryCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanOffer_planId_countryCode_billingCycle_key" ON "PlanOffer"("planId", "countryCode", "billingCycle");

-- CreateIndex
CREATE INDEX "PriceSource_countryCode_isActive_idx" ON "PriceSource"("countryCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PriceSource_platformId_countryCode_url_key" ON "PriceSource"("platformId", "countryCode", "url");

-- CreateIndex
CREATE INDEX "ScrapeRun_platformId_countryCode_startedAt_idx" ON "ScrapeRun"("platformId", "countryCode", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_platformId_tierKey_key" ON "Plan"("platformId", "tierKey");

-- CreateIndex
CREATE INDEX "PriceHistory_offerId_recordedAt_idx" ON "PriceHistory"("offerId", "recordedAt");

-- AddForeignKey
ALTER TABLE "PlanOffer" ADD CONSTRAINT "PlanOffer_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PlanOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSource" ADD CONSTRAINT "PriceSource_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformCountry" ADD CONSTRAINT "PlatformCountry_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Matriz inicial plataforma × país (12 países / 10 moedas).
INSERT INTO "PlatformCountry" ("platformId", "countryCode", "status", "updatedAt")
SELECT
    p."id",
    c."code",
    CASE
        WHEN c."code" = 'BR' THEN 'OPERATES'
        WHEN p."slug" IN ('looke', 'globoplay') THEN 'NOT_AVAILABLE'
        ELSE 'UNKNOWN'
    END,
    NOW()
FROM "Platform" p
CROSS JOIN (
    VALUES
        ('BR'), ('US'), ('CA'), ('GB'), ('AU'), ('MX'),
        ('DE'), ('PT'), ('ES'), ('JP'), ('IN'), ('KR')
) AS c("code")
ON CONFLICT ("platformId", "countryCode") DO NOTHING;

-- Fonte de scraping já existente no código.
INSERT INTO "PriceSource" (
    "id",
    "platformId",
    "countryCode",
    "url",
    "parserKey",
    "renderMode",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    'looke-br-' || p."id",
    p."id",
    'BR',
    'https://www.looke.com.br/planos',
    'looke',
    'HTTP',
    TRUE,
    NOW(),
    NOW()
FROM "Platform" p
WHERE p."slug" = 'looke'
ON CONFLICT ("platformId", "countryCode", "url") DO NOTHING;
