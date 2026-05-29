-- 1) Add a dedicated event type for WhatsApp delivery callbacks
ALTER TYPE public.admin_notif_event ADD VALUE IF NOT EXISTS 'delivery_callback';

-- 2) Fix hardcoded URL in notify_admin_async that pointed to a different Supabase project
CREATE OR REPLACE FUNCTION public.notify_admin_async(p_event_type text, p_variables jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_url text;
  v_cron_secret text;
  v_headers jsonb;
BEGIN
  BEGIN
    v_url := 'https://yjynquqwhnorsgzsakep.supabase.co/functions/v1/admin-notify';
    v_cron_secret := public.get_cron_secret();

    v_headers := jsonb_build_object('Content-Type', 'application/json');
    IF v_cron_secret IS NOT NULL AND length(v_cron_secret) > 0 THEN
      v_headers := v_headers || jsonb_build_object('x-cron-secret', v_cron_secret);
    END IF;

    PERFORM net.http_post(
      url := v_url,
      headers := v_headers,
      body := jsonb_build_object('event_type', p_event_type, 'variables', p_variables)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'notify_admin_async failed: %', SQLERRM;
  END;
END;
$function$;