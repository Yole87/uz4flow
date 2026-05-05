-- Backfill missing trial/period dates for active free subscriptions
UPDATE public.subscriptions s
SET
  current_period_start = COALESCE(s.current_period_start, now()),
  trial_end = COALESCE(s.trial_end, now() + (COALESCE(sp.trial_days, 7) || ' days')::interval),
  current_period_end = COALESCE(s.current_period_end, now() + (COALESCE(sp.trial_days, 7) || ' days')::interval),
  updated_at = now()
FROM public.subscription_plans sp
WHERE sp.id = s.plan_id
  AND s.status = 'active'
  AND (sp.is_free = true OR sp.price = 0)
  AND (s.trial_end IS NULL OR s.current_period_end IS NULL);