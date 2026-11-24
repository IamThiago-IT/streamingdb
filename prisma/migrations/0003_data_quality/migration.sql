-- Qualidade e proveniência dos dados.
-- Migration aditiva: não remove colunas nem registros existentes.
-- Registros antigos ficam como UNVERIFIED; nenhuma verificação é presumida.
--
-- A transação evita migração parcial: se qualquer passo falhar, todo o DDL e
-- backfill é revertido em vez de deixar o schema em estado intermediário.

BEGIN;

-- ---------------------------------------------------------------------------
-- Proveniência nas entidades principais
-- ---------------------------------------------------------------------------

ALTER TABLE "Platform"
  ADD COLUMN "source" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "collectionMethod" TEXT,
  ADD COLUMN "collectedAt" TIMESTAMP(3),
  ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED';

ALTER TABLE "Plan"
  ADD COLUMN "source" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "collectionMethod" TEXT,
  ADD COLUMN "collectedAt" TIMESTAMP(3),
  ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED';

ALTER TABLE "PlanOffer"
  ADD COLUMN "collectionMethod" TEXT,
  ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "collectedAt" TIMESTAMP(3),
  ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);

ALTER TABLE "Content"
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "collectionMethod" TEXT,
  ADD COLUMN "collectedAt" TIMESTAMP(3),
  ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED';

ALTER TABLE "ContentAvailability"
  ADD COLUMN "source" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "collectionMethod" TEXT,
  ADD COLUMN "collectedAt" TIMESTAMP(3),
  ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED';

ALTER TABLE "PlatformCountry"
  ADD COLUMN "source" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "collectionMethod" TEXT,
  ADD COLUMN "collectedAt" TIMESTAMP(3),
  ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED';

ALTER TABLE "PriceHistory"
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "collectedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- Histórico de alterações e auditoria de coleta
-- ---------------------------------------------------------------------------

ALTER TABLE "ChangeLog"
  ADD COLUMN "entityType" TEXT,
  ADD COLUMN "entityId" TEXT,
  ADD COLUMN "field" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "process" TEXT,
  ADD COLUMN "actor" TEXT,
  ADD COLUMN "metadata" TEXT;

ALTER TABLE "ScrapeRun"
  ALTER COLUMN "platformId" DROP NOT NULL,
  ALTER COLUMN "countryCode" DROP NOT NULL,
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'SCRAPE',
  ADD COLUMN "source" TEXT,
  ADD COLUMN "recordsCreated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recordsUnchanged" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recordsFailed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "errorCode" TEXT;

-- ---------------------------------------------------------------------------
-- Novos modelos
-- ---------------------------------------------------------------------------

CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "collectionMethod" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataQualityIssue" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityIds" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "message" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);

-- `dedupeKey` é a chave idempotente de proveniência usada pelo ON CONFLICT
-- do backfill abaixo.
CREATE UNIQUE INDEX "DataSource_dedupeKey_key" ON "DataSource"("dedupeKey");

-- ---------------------------------------------------------------------------
-- Backfill: proveniência de ofertas
-- ---------------------------------------------------------------------------

-- `lastSuccessAt` só é aceito como verificação quando a origem não é o seed
-- nem o modelo legado. O seed marcava lastSuccessAt = now() sem verificar nada.
UPDATE "PlanOffer"
SET
  "collectedAt" = COALESCE("lastCheckedAt", "createdAt"),
  "collectionMethod" = CASE WHEN "sourceType" = 'SEED' THEN 'SEED' ELSE NULL END,
  "verificationStatus" = CASE
    WHEN "sourceType" IN ('SEED', 'LEGACY') THEN 'UNVERIFIED'
    WHEN "lastSuccessAt" IS NOT NULL THEN 'VERIFIED'
    ELSE 'UNVERIFIED'
  END,
  "lastVerifiedAt" = CASE
    WHEN "sourceType" NOT IN ('SEED', 'LEGACY') THEN "lastSuccessAt"
    ELSE NULL
  END;

UPDATE "PriceHistory" h
SET
  "sourceType" = o."sourceType",
  "sourceUrl" = o."sourceUrl",
  "verificationStatus" = o."verificationStatus",
  "collectedAt" = h."createdAt"
FROM "PlanOffer" o
WHERE o."id" = h."offerId";

-- Cada oferta existente ganha uma linha de proveniência. Fontes antigas não
-- são apagadas; novas fontes entram como linhas adicionais.
INSERT INTO "DataSource" (
  "id", "dedupeKey", "entityType", "entityId", "source", "sourceUrl",
  "collectionMethod", "collectedAt", "lastVerifiedAt", "verificationStatus",
  "isPrimary", "createdAt", "updatedAt"
)
SELECT
  'ds-' || o."id",
  'PLAN_OFFER:' || o."id" || ':' || o."sourceType" || ':' || COALESCE(o."sourceUrl", ''),
  'PLAN_OFFER',
  o."id",
  o."sourceType",
  o."sourceUrl",
  COALESCE(o."collectionMethod", 'LEGACY'),
  COALESCE(o."collectedAt", o."createdAt"),
  o."lastVerifiedAt",
  o."verificationStatus",
  TRUE,
  NOW(),
  NOW()
FROM "PlanOffer" o
ON CONFLICT ("dedupeKey") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill: histórico de alterações
-- ---------------------------------------------------------------------------

UPDATE "ChangeLog"
SET
  "entityType" = 'CONTENT',
  "entityId" = "contentId",
  "process" = COALESCE("process", 'LEGACY')
WHERE "contentId" IS NOT NULL;

UPDATE "ChangeLog"
SET
  "entityType" = 'PLATFORM',
  "entityId" = "platformId",
  "process" = COALESCE("process", 'LEGACY')
WHERE "contentId" IS NULL AND "platformId" IS NOT NULL;

-- Normaliza apenas espaços em listas de gênero; não remove nem renomeia
-- gêneros existentes.
UPDATE "Content"
SET "genre" = (
  SELECT string_agg(btrim(g), ', ')
  FROM unnest(string_to_array("Content"."genre", ',')) AS g
  WHERE btrim(g) <> ''
)
WHERE "genre" IS NOT NULL AND "genre" <> '';

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "Content_externalSource_externalId_key" ON "Content"("externalSource", "externalId");
CREATE INDEX "Content_title_year_type_idx" ON "Content"("title", "year", "type");
CREATE INDEX "Content_verificationStatus_lastVerifiedAt_idx" ON "Content"("verificationStatus", "lastVerifiedAt");
CREATE INDEX "ContentAvailability_platformId_available_lastVerifiedAt_idx" ON "ContentAvailability"("platformId", "available", "lastVerifiedAt");
CREATE INDEX "Platform_verificationStatus_lastVerifiedAt_idx" ON "Platform"("verificationStatus", "lastVerifiedAt");
CREATE INDEX "Plan_verificationStatus_lastVerifiedAt_idx" ON "Plan"("verificationStatus", "lastVerifiedAt");
CREATE INDEX "PlanOffer_verificationStatus_lastVerifiedAt_idx" ON "PlanOffer"("verificationStatus", "lastVerifiedAt");
CREATE INDEX "PlatformCountry_verificationStatus_lastVerifiedAt_idx" ON "PlatformCountry"("verificationStatus", "lastVerifiedAt");
CREATE INDEX "DataSource_entityType_entityId_idx" ON "DataSource"("entityType", "entityId");
CREATE INDEX "DataSource_verificationStatus_lastVerifiedAt_idx" ON "DataSource"("verificationStatus", "lastVerifiedAt");
CREATE INDEX "DataQualityIssue_status_severity_idx" ON "DataQualityIssue"("status", "severity");
CREATE INDEX "DataQualityIssue_rule_idx" ON "DataQualityIssue"("rule");
CREATE INDEX "DataQualityIssue_entityType_lastSeenAt_idx" ON "DataQualityIssue"("entityType", "lastSeenAt");
CREATE INDEX "DataQualityIssue_lastSeenAt_idx" ON "DataQualityIssue"("lastSeenAt");
CREATE INDEX "ChangeLog_entityType_entityId_createdAt_idx" ON "ChangeLog"("entityType", "entityId", "createdAt");
CREATE INDEX "ChangeLog_createdAt_idx" ON "ChangeLog"("createdAt");
CREATE INDEX "ChangeLog_type_createdAt_idx" ON "ChangeLog"("type", "createdAt");
CREATE INDEX "ScrapeRun_kind_startedAt_idx" ON "ScrapeRun"("kind", "startedAt");
CREATE INDEX "ScrapeRun_status_startedAt_idx" ON "ScrapeRun"("status", "startedAt");

COMMIT;
