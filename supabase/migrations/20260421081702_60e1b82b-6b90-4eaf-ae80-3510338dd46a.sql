CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'), '')
  );

  -- Fire admin notification for new free signup (non-blocking)
  PERFORM public.notify_admin_async('signup_free', jsonb_build_object(
    'user_name', COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'user_email', NEW.email,
    'date', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
  ));

  RETURN NEW;
END;
$function$;