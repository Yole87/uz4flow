-- Remove email column from profiles table (not used in application)
-- The email is available via auth.users and displayed from useAuth context

-- First, update the trigger to not insert email anymore
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$function$;

-- Then remove the email column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;