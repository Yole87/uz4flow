# Corrigir acesso cross-tenant nos arquivos de formulários

## O problema (confirmado no banco)

O bucket `form-uploads` (privado) hoje tem políticas permissivas que ignoram a quem o arquivo pertence:

- `form_uploads_read_authenticated` — qualquer usuário logado **lê** qualquer arquivo do bucket.
- `form_uploads_delete_authenticated` — qualquer usuário logado **apaga** qualquer arquivo do bucket.

Essas duas convivem com as versões corretas já existentes (`form_uploads_org_read` e `form_uploads_org_delete`, que checam a organização). Como no Postgres as políticas de um mesmo comando se somam (OR), as versões permissivas anulam a proteção das corretas.

O bucket `form-images` (usado nas imagens dos passos do formulário) tem o mesmo tipo de brecha em gravação: `form_images_auth_insert`, `form_images_auth_update` e `form_images_auth_delete` só verificam o nome do bucket, então qualquer usuário logado pode sobrescrever ou apagar a imagem de outro cliente.

Há ainda uma política de inserção duplicada e quebrada em `form-uploads` (`form_uploads_anyone_insert`), cuja verificação compara o id da organização com o **nome** da organização — nunca casa e só polui as regras.

## Estrutura real dos arquivos (verificada)

- `form-uploads`: `organization_id/form_id/arquivo.ext` (4 arquivos, todos nesse padrão).
- `form-images`: `form_id/arquivo.ext` (1 arquivo).

As correções seguem exatamente esses padrões, então nenhum arquivo existente deixa de ser acessível pelo dono.

## O que será feito

1. Remover as políticas permissivas de leitura e exclusão de `form-uploads`, mantendo apenas as versões que validam a organização do usuário (com exceção para o admin master).
2. Remover a política de inserção duplicada/quebrada e manter uma única regra de envio público, exigindo que a pasta raiz seja o id de uma organização que realmente possua um formulário ativo, com limite de 10 MB por arquivo.
3. Adicionar uma regra de atualização em `form-uploads` restrita à organização dona do arquivo.
4. Substituir as regras de gravação de `form-images` por versões que exigem que a pasta raiz seja um formulário pertencente à organização do usuário; a leitura pública das imagens continua como está (elas aparecem no formulário público).
5. Definir o limite de tamanho do bucket `form-uploads` em 10 MB no próprio bucket, reforçando a checagem da política.

## Detalhes técnicos

Migração única sobre `storage.objects`:

```text
DROP POLICY form_uploads_read_authenticated
DROP POLICY form_uploads_delete_authenticated
DROP POLICY form_uploads_anyone_insert
DROP POLICY form_images_auth_insert / _auth_update / _auth_delete

CREATE POLICY form_uploads_public_insert  (anon, authenticated)
  bucket_id = 'form-uploads'
  AND size <= 10 MB
  AND foldername[1] = organization_id de um uz_forms ativo

CREATE POLICY form_uploads_org_update (authenticated)
  is_admin_master() OR foldername[1] IN get_user_organization_ids(auth.uid())

CREATE POLICY form_images_org_insert / _org_update / _org_delete (authenticated)
  is_admin_master() OR foldername[1] = id de uz_form cuja organization_id
  está em get_user_organization_ids(auth.uid())
```

`form_uploads_org_read` e `form_uploads_org_delete` permanecem inalteradas — passam a ser as únicas regras de leitura/exclusão do bucket.

Depois: limite do bucket `form-uploads` em 10 MB e nova varredura de segurança para confirmar que os dois achados críticos ficaram resolvidos. Nenhuma mudança em código de frontend é necessária.
