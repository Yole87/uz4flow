CREATE OR REPLACE FUNCTION public.get_public_form(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_form public.uz_forms%ROWTYPE;
  v_mode text;
  v_watermark text;
  v_result jsonb;
BEGIN
  SELECT * INTO v_form
  FROM public.uz_forms
  WHERE token = p_token
    AND is_active = true
    AND is_deleted = false
  LIMIT 1;

  IF v_form.id IS NULL THEN
    SELECT * INTO v_form
    FROM public.uz_forms
    WHERE slug = p_token
      AND is_active = true
      AND is_deleted = false
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  IF v_form.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT NULLIF(sp.limits->>'uz_forms_watermark_mode', ''),
         NULLIF(sp.limits->>'uz_forms_watermark_text', '')
    INTO v_mode, v_watermark
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.organization_id = v_form.organization_id
    AND s.status = 'active'
  LIMIT 1;

  IF v_mode IS NULL OR v_mode NOT IN ('platform', 'custom', 'tenant_choice') THEN
    v_mode := CASE WHEN v_watermark IS NOT NULL THEN 'custom' ELSE 'platform' END;
  END IF;

  SELECT jsonb_build_object(
    'id', v_form.id,
    'organization_id', v_form.organization_id,
    'name', v_form.name,
    'slug', v_form.slug,
    'token', v_form.token,
    'is_active', v_form.is_active,
    'is_deleted', v_form.is_deleted,
    'deleted_at', v_form.deleted_at,
    'settings', COALESCE(v_form.settings, '{}'::jsonb),
    'created_at', v_form.created_at,
    'updated_at', v_form.updated_at,
    'watermark_mode', v_mode,
    'watermark_text', COALESCE(v_watermark, 'Feito com Uz4Flow'),
    'steps', COALESCE((
      SELECT jsonb_agg(step_obj ORDER BY (step_obj->>'step_order')::int)
      FROM (
        SELECT jsonb_build_object(
          'id', st.id,
          'form_id', st.form_id,
          'step_order', st.step_order,
          'title', st.title,
          'description', st.description,
          'media_type', st.media_type,
          'media_url', st.media_url,
          'created_at', st.created_at,
          'updated_at', st.updated_at,
          'fields', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', fl.id,
              'step_id', fl.step_id,
              'field_type', fl.field_type,
              'label', fl.label,
              'key_name', fl.key_name,
              'is_required', fl.is_required,
              'options', COALESCE(fl.options, '[]'::jsonb),
              'field_order', fl.field_order,
              'created_at', fl.created_at
            ) ORDER BY fl.field_order)
            FROM public.uz_form_fields fl
            WHERE fl.step_id = st.id
          ), '[]'::jsonb)
        ) AS step_obj
        FROM public.uz_form_steps st
        WHERE st.form_id = v_form.id
      ) sub
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_form(text) TO anon, authenticated;