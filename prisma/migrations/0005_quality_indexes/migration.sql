-- Reconcilia índices que o Postgres trunca/normaliza.
-- 0003/0004 já podem ter sido aplicadas em ambientes de teste; esta migration
-- é idempotente e corrige o nome sem recriar dados.

BEGIN;

-- O nome automático tem 68 caracteres e o Postgres trunca em 63, gerando
-- drift. Renomeia para o nome curto declarado no schema.
ALTER INDEX IF EXISTS "ContentAvailability_platformId_countryCode_available_lastVerifi"
  RENAME TO "ContentAvailability_live_idx";

-- Faltava o índice único que sustenta o fingerprint idempotente dos problemas.
CREATE UNIQUE INDEX IF NOT EXISTS "DataQualityIssue_fingerprint_key"
  ON "DataQualityIssue"("fingerprint");

COMMIT;
