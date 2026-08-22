CREATE OR REPLACE FUNCTION public.get_public_form(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_form public.uz_forms%ROWTYPE;
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
    RETURN NULL;
  END IF;

  SELECT NULLIF(sp.limits->>'uz_forms_watermark_text', '')
    INTO v_watermark
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.organization_id = v_form.organization_id
    AND s.status = 'active'
  LIMIT 1;

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
    'watermark_text', COALESCE(v_watermark, 'Feito com Uz4FLOW'),
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
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_form(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_form(text) TO anon, authenticated;

-- Storage policies: form-images (public read via signed/anon access, tenant write)
CREATE POLICY "form_images_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'form-images');

CREATE POLICY "form_images_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'form-images');

CREATE POLICY "form_images_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'form-images');

CREATE POLICY "form_images_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'form-images');

-- Storage policies: form-uploads (anyone can submit files, only members read)
CREATE POLICY "form_uploads_anyone_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'form-uploads'
  AND COALESCE((metadata->>'size')::bigint, 0) <= 10485760
);

CREATE POLICY "form_uploads_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'form-uploads');

CREATE POLICY "form_uploads_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'form-uploads');