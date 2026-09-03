# Corrigir 403 no upload de imagem de produto (bucket form-images)

## Diagnóstico esperado

O bucket `form-images` já teve políticas org-scoped definidas no plano de 26/08 (`form_images_org_insert`, `form_images_org_update`, `form_images_org_delete`), que exigem:

- `foldername[1]` = id de um formulário (`uz_forms`) pertencente a uma organização do usuário logado (ou admin master).

O 403 atual tem duas causas possíveis:

1. Essas políticas nunca foram executadas no banco (migration pendente), deixando o bucket sem regra de INSERT.
2. O novo upload da Página de Compra (imagem de produto) usa um path diferente de `{form_id}/{arquivo}` — por exemplo `{form_id}/products/{uuid}.ext` ou outro prefixo — e não casa com a regra existente.

## O que será feito (somente SQL, nenhum código alterado)

1. **Inspecionar** as políticas atuais de `storage.objects` para `form-images` e a configuração do bucket (público/privado).
2. **Aplicar a correção conforme o cenário encontrado:**
   - Se não existir política de INSERT: criar `form_images_org_insert` org-scoped (pasta raiz deve ser um `uz_form` da organização do usuário, ou admin master).
   - Se a política existe mas o path do upload de produto não casa: ajustar o código de upload para usar `{form_id}/{uuid}.ext` (o padrão já existente), mantendo a política intacta.
3. **Garantir consistência** de SELECT/UPDATE/DELETE no mesmo padrão org-scoped.
4. **Não** criar a política permissiva `WITH CHECK (bucket_id = 'form-images')` — ela permitiria a qualquer usuário logado gravar/apagar imagens de outros clientes (a brecha cross-tenant que já corrigimos).

## Detalhes técnicos

```text
-- Política pretendida (se ausente):
CREATE POLICY form_images_org_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'form-images'
  AND (
    public.is_admin_master()
    OR (storage.foldername(name))[1]::uuid IN (
      SELECT f.id FROM public.uz_forms f
      WHERE f.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  )
);
```

Após aplicar, testar upload real de imagem de produto na Página de Compra e confirmar ausência de 403.
