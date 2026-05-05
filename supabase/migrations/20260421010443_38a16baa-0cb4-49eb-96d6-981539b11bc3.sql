-- Ensure pg_net is available
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper to call admin-notify edge function asynchronously
CREATE OR REPLACE FUNCTION public.notify_admin_async(p_event_type text, p_variables jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_service_key text;
BEGIN
  -- Try to read service role key from cron_secrets if available, else fall back to env var via current_setting
  BEGIN
    SELECT 'https://deuhtstjhuvyugilnifg.supabase.co/functions/v1/admin-notify' INTO v_url;
    -- Use anon-style call (admin-notify doesn't require auth, validates internally)
    PERFORM net.http_post(
      url := v_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('event_type', p_event_type, 'variables', p_variables)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Swallow errors; never break the calling trigger
    RAISE NOTICE 'notify_admin_async failed: %', SQLERRM;
  END;
END;
$$;

-- Update handle_new_user to also fire signup_free notification
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL)
  );

  -- Fire admin notification for new free signup (non-blocking)
  PERFORM public.notify_admin_async('signup_free', jsonb_build_object(
    'user_name', COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'user_email', NEW.email,
    'date', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
  ));

  RETURN NEW;
END;
$$;

-- Update handle_affiliate_referral_attribution to fire new_referral notification
CREATE OR REPLACE FUNCTION public.handle_affiliate_referral_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_code text;
  v_affiliate_id uuid;
  v_window_days int;
  v_aff_user_email text;
  v_referred_email text;
BEGIN
  SELECT raw_user_meta_data->>'ref_code' INTO v_ref_code FROM auth.users WHERE id = NEW.id;

  IF v_ref_code IS NULL OR length(v_ref_code) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_affiliate_id
  FROM public.affiliates
  WHERE code = v_ref_code AND status = 'approved'
  LIMIT 1;

  IF v_affiliate_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT attribution_window_days INTO v_window_days FROM public.affiliate_settings LIMIT 1;
  v_window_days := COALESCE(v_window_days, 30);

  INSERT INTO public.affiliate_referrals (
    affiliate_id, referred_user_id, ref_code, signup_at, attribution_expires_at, current_status
  ) VALUES (
    v_affiliate_id, NEW.id, v_ref_code, now(), now() + (v_window_days || ' days')::interval, 'signup'
  )
  ON CONFLICT (referred_user_id) DO NOTHING;

  -- Get affiliate's email and referred user's email for notification
  SELECT u.email INTO v_aff_user_email
  FROM auth.users u
  JOIN public.affiliates a ON a.user_id = u.id
  WHERE a.id = v_affiliate_id;

  SELECT email INTO v_referred_email FROM auth.users WHERE id = NEW.id;

  PERFORM public.notify_admin_async('affiliate_new_referral', jsonb_build_object(
    'affiliate_email', COALESCE(v_aff_user_email, ''),
    'affiliate_code', v_ref_code,
    'user_email', COALESCE(v_referred_email, ''),
    'date', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
  ));

  RETURN NEW;
END;
$$;

-- Function for cron: notify trials expiring at D-3, D-1, D-0
CREATE OR REPLACE FUNCTION public.notify_trial_expirations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_org RECORD;
  v_days_left int;
  v_owner_email text;
BEGIN
  -- Find trial subscriptions expiring in 0, 1 or 3 days
  FOR v_org IN
    SELECT 
      s.id AS sub_id,
      s.organization_id,
      s.current_period_end,
      o.name AS org_name,
      o.owner_user_id,
      EXTRACT(DAY FROM (s.current_period_end - now()))::int AS days_left
    FROM public.subscriptions s
    JOIN public.organizations o ON o.id = s.organization_id
    JOIN public.subscription_plans p ON p.id = s.plan_id
    WHERE s.status = 'active'
      AND p.price = 0
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end > now()
      AND s.current_period_end < now() + interval '4 days'
  LOOP
    v_days_left := GREATEST(0, EXTRACT(DAY FROM (v_org.current_period_end - now()))::int);

    -- Only fire on D-3, D-1, D-0
    IF v_days_left NOT IN (0, 1, 3) THEN
      CONTINUE;
    END IF;

    -- Anti-duplicate: skip if already notified today for this org
    IF EXISTS (
      SELECT 1 FROM public.admin_notification_logs
      WHERE event_type = 'free_plan_expiring'
        AND payload->'variables'->>'organization_id' = v_org.organization_id::text
        AND created_at >= date_trunc('day', now())
    ) THEN
      CONTINUE;
    END IF;

    SELECT email INTO v_owner_email FROM auth.users WHERE id = v_org.owner_user_id;

    PERFORM public.notify_admin_async('free_plan_expiring', jsonb_build_object(
      'user_name', v_org.org_name,
      'user_email', COALESCE(v_owner_email, ''),
      'organization_id', v_org.organization_id::text,
      'days_left', v_days_left,
      'expires_at', to_char(v_org.current_period_end AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
    ));

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('notified', v_count, 'executed_at', now());
END;
$$;