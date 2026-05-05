-- Adicionar colunas para Google Places API (New)
ALTER TABLE prospect_providers
ADD COLUMN IF NOT EXISTS google_places_api_key_encrypted text,
ADD COLUMN IF NOT EXISTS google_places_api_key_masked text,
ADD COLUMN IF NOT EXISTS google_places_configured boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS google_places_last_test_at timestamptz,
ADD COLUMN IF NOT EXISTS preferred_provider text DEFAULT 'scraping';

-- Adicionar constraint para preferred_provider usando trigger ao invés de CHECK
CREATE OR REPLACE FUNCTION validate_preferred_provider()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.preferred_provider NOT IN ('scraping', 'places_api') THEN
    RAISE EXCEPTION 'preferred_provider must be either scraping or places_api';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS validate_preferred_provider_trigger ON prospect_providers;
CREATE TRIGGER validate_preferred_provider_trigger
BEFORE INSERT OR UPDATE ON prospect_providers
FOR EACH ROW
EXECUTE FUNCTION validate_preferred_provider();