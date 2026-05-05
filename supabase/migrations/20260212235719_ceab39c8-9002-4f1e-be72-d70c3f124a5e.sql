
-- Migrate old feature keys to new grouped keys in subscription_plans
UPDATE public.subscription_plans
SET limits = jsonb_set(
  limits,
  '{features}',
  (
    SELECT jsonb_agg(DISTINCT new_key)
    FROM (
      SELECT 
        CASE elem
          WHEN 'crm' THEN 'crm_whatsapp'
          WHEN 'pipeline' THEN 'crm_whatsapp'
          WHEN 'templates' THEN 'crm_whatsapp'
          WHEN 'auto_reengagement' THEN 'crm_whatsapp'
          WHEN 'whatsapp_followup' THEN 'crm_whatsapp'
          WHEN 'flows' THEN 'automations'
          WHEN 'connectors' THEN 'automations'
          WHEN 'rules' THEN 'automations'
          WHEN 'voice_calls' THEN 'ai_features'
          WHEN 'voice_campaigns' THEN 'ai_features'
          WHEN 'ai_analysis' THEN 'ai_features'
          WHEN 'basic_analytics' THEN 'analytics'
          WHEN 'advanced_analytics' THEN 'analytics'
          ELSE elem
        END AS new_key
      FROM jsonb_array_elements_text(limits->'features') AS elem
    ) mapped
  )
)
WHERE limits->'features' IS NOT NULL
  AND jsonb_array_length(limits->'features') > 0;
