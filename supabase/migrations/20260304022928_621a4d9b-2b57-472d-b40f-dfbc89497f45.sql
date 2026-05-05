DROP VIEW IF EXISTS public.instances_safe;
CREATE VIEW public.instances_safe WITH (security_invoker = true, security_barrier = true) AS
SELECT id,
    organization_id,
    name,
    provider,
    phone_number,
    status,
    qr_code,
    webhook_url,
    api_url,
    openbot_instance_id,
    meta_phone_number_id,
    created_at,
    updated_at,
    (api_key_encrypted IS NOT NULL) AS has_api_key,
    (openbot_api_key_encrypted IS NOT NULL) AS has_openbot_api_key
   FROM instances;