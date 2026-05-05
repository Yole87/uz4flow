CREATE OR REPLACE FUNCTION public.enforce_max_3_recipients()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.admin_notification_recipients) >= 3 THEN
    RAISE EXCEPTION 'Máximo de 3 destinatários permitido';
  END IF;
  RETURN NEW;
END;
$$;