UPDATE public.admin_notification_logs
SET event_type = 'delivery_callback'
WHERE status = 'callback' AND event_type = 'signup_free';