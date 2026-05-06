UPDATE public.saas_settings
SET value = jsonb_set(value, '{app_name}', '"Uz4Flow"')
WHERE key = 'general' AND value->>'app_name' = 'OpenFlow';