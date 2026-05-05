-- =============================================
-- Prospect Providers Table (stores user credentials)
-- =============================================
CREATE TABLE public.prospect_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Provider selection
  active_provider TEXT DEFAULT 'google' CHECK (active_provider IN ('google', 'firecrawl')),
  
  -- Google Custom Search credentials (encrypted)
  google_api_key_encrypted TEXT,
  google_api_key_masked TEXT,
  google_cse_id_encrypted TEXT,
  google_cse_id_masked TEXT,
  
  -- Firecrawl credentials (encrypted)  
  firecrawl_api_key_encrypted TEXT,
  firecrawl_api_key_masked TEXT,
  
  -- Status tracking
  google_configured BOOLEAN DEFAULT false,
  firecrawl_configured BOOLEAN DEFAULT false,
  google_last_test_at TIMESTAMPTZ,
  firecrawl_last_test_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id)
);

-- =============================================
-- Prospect Searches Table (search history)
-- =============================================
CREATE TABLE public.prospect_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Search parameters
  keyword TEXT NOT NULL,
  location TEXT,
  social_networks TEXT[] DEFAULT '{}',
  whatsapp_only BOOLEAN DEFAULT false,
  
  -- Provider used for this search
  provider_used TEXT NOT NULL CHECK (provider_used IN ('google', 'firecrawl')),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_results INTEGER DEFAULT 0,
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- =============================================
-- Prospect Results Table (individual leads)
-- =============================================
CREATE TABLE public.prospect_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID NOT NULL REFERENCES prospect_searches(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Lead data
  business_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  social_urls JSONB DEFAULT '{}',
  has_whatsapp BOOLEAN DEFAULT false,
  
  -- AI analysis
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
  ai_analysis JSONB,
  
  -- Source tracking
  source_url TEXT,
  raw_data JSONB,
  
  -- Import status
  imported_at TIMESTAMPTZ,
  imported_to_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Enable RLS on all tables
-- =============================================
ALTER TABLE public.prospect_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_results ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies for prospect_providers
-- =============================================
CREATE POLICY "Users can view their organization providers"
ON public.prospect_providers FOR SELECT
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their organization providers"
ON public.prospect_providers FOR INSERT
WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can update their organization providers"
ON public.prospect_providers FOR UPDATE
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their organization providers"
ON public.prospect_providers FOR DELETE
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- =============================================
-- RLS Policies for prospect_searches
-- =============================================
CREATE POLICY "Users can view their organization searches"
ON public.prospect_searches FOR SELECT
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their organization searches"
ON public.prospect_searches FOR INSERT
WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can update their organization searches"
ON public.prospect_searches FOR UPDATE
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their organization searches"
ON public.prospect_searches FOR DELETE
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- =============================================
-- RLS Policies for prospect_results
-- =============================================
CREATE POLICY "Users can view their organization results"
ON public.prospect_results FOR SELECT
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can insert their organization results"
ON public.prospect_results FOR INSERT
WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can update their organization results"
ON public.prospect_results FOR UPDATE
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users can delete their organization results"
ON public.prospect_results FOR DELETE
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- =============================================
-- Trigger for updated_at on prospect_providers
-- =============================================
CREATE TRIGGER update_prospect_providers_updated_at
BEFORE UPDATE ON public.prospect_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Indexes for better performance
-- =============================================
CREATE INDEX idx_prospect_searches_org ON public.prospect_searches(organization_id);
CREATE INDEX idx_prospect_searches_status ON public.prospect_searches(status);
CREATE INDEX idx_prospect_results_search ON public.prospect_results(search_id);
CREATE INDEX idx_prospect_results_org ON public.prospect_results(organization_id);
CREATE INDEX idx_prospect_results_score ON public.prospect_results(ai_score DESC);