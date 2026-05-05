-- Alterar default de 'google' para 'firecrawl' na coluna active_provider
ALTER TABLE prospect_providers 
ALTER COLUMN active_provider SET DEFAULT 'firecrawl';

-- Atualizar registros existentes que ainda usam google e não estão configurados
UPDATE prospect_providers 
SET active_provider = 'firecrawl'
WHERE active_provider = 'google' 
AND google_configured = false;