# Correções do módulo Formulários (uz_forms)

Antes de tudo: verifiquei o código e dois pontos do pedido estão diagnosticados de forma diferente do que parecia.

- A rota `/f/:token` **já é pública** em `App.tsx` (fora de qualquer guarda). O motivo real de o formulário público não abrir sem login é o **banco**: as políticas de leitura de `uz_forms`, `uz_form_steps` e `uz_form_fields` só permitem `authenticated` membro da organização. Visitante anônimo não consegue ler nada.
- O `UzFormEditor.tsx` **já chama** `createBucket('form-images')` no fallback de upload. Só que criar bucket pelo cliente exige permissão de admin — a criação precisa ser feita no backend (migração), não no navegador.

## O que será feito

### 1. Acesso público ao formulário (crítico)
- Migração criando uma função segura `get_public_form(token)` que devolve o formulário ativo (com etapas, campos) **e** o texto da marca d'água vindo do plano da organização — sem expor nada além disso.
- `getPublicForm()` em `uzFormService.ts` passa a chamar essa função em vez de consultar as tabelas direto.
- Nenhuma política ampla de leitura anônima nas tabelas (mantém isolamento entre clientes).

### 2. Buckets de arquivos
- Criar os buckets públicos `form-images` (imagens das etapas, upload pelo tenant) e `form-uploads` (arquivos de quem responde) pela ferramenta de storage da plataforma, com limite de 10 MB por arquivo em `form-uploads`.
- Políticas em `storage.objects`: leitura pública nos dois; escrita do tenant em `form-images`; escrita anônima permitida apenas em `form-uploads`, com verificação de tamanho máximo de 10 MB na política.
- Fallback no código: helper `uploadToBucket()` em `uzFormService.ts` que, ao receber erro de bucket inexistente (`NoSuchBucket` / status 404), tenta `supabase.storage.createBucket()` dentro de try/catch (ignorando "already exists") e refaz o upload uma vez.
- `UzFormEditor.tsx` e `PublicForm.tsx` passam a usar esse helper em vez de chamar o storage direto.

### 3. Upload de arquivo na resposta
- `PublicForm.tsx`: campo `file_upload` passa a subir o arquivo para `form-uploads` (com spinner durante o envio) e grava a **URL pública** em `response_data`.
- Comentário `// TODO:` no ponto do upload registrando que validação de tipo de arquivo fica para uma próxima iteração — por ora qualquer tipo é aceito (o limite de 10 MB continua valendo).
- `UzFormResponses.tsx`: célula com valor iniciando em `https://` vira link "Baixar arquivo" abrindo em nova aba; no CSV vai a URL completa.


### 4. Máscara de CPF
- Corrigir `maskCPF` para cortar em 11 dígitos (formato `000.000.000-00`), impedindo o 12º dígito.

### 5. Datas
- `UzFormResponses.tsx`: valores no padrão `AAAA-MM-DD` são exibidos como `DD/MM/AAAA`, tanto na tabela quanto no CSV.

### 6. Cabeçalho da tabela vazando
- Ajustar o contêiner da tabela de respostas com rolagem horizontal contida (`overflow-x-auto` + largura mínima na tabela), para não invadir o menu lateral.

### 7. Marca d'água controlada pelo plano
- O texto vem do plano e é entregue pela função pública do item 1. O tenant não edita mais esse campo.
- Onde está o dado (confirmado no banco): `subscription_plans.limits` (jsonb). O vínculo é `organizations.id` → `subscriptions.organization_id` → `subscriptions.plan_id` → `subscription_plans.id`.
- JOIN dentro de `get_public_form`:
  ```sql
  select sp.limits->>'uz_forms_watermark_text'
    from subscriptions s
    join subscription_plans sp on sp.id = s.plan_id
   where s.organization_id = f.organization_id
     and s.status = 'active'
   limit 1
  ```
  Se não houver assinatura ativa ou a chave estiver vazia, cai num texto padrão da plataforma. É um subselect simples dentro da função `SECURITY DEFINER` — não precisa da alternativa de guardar o texto na organização.
- Adicionar o campo no editor de planos do super admin (`/admin/plans`).

### 8. Slug dentro do editor
- Sem aba nova: seção recolhível **"Configurações do Formulário"** no final do painel direito do `UzFormEditor.tsx`, mostrando o slug e a URL pública (com botão de copiar).
- Editável apenas se o plano tiver `limits.uz_forms_allow_custom_slug === true`; caso contrário aparece somente leitura com aviso de upgrade.
- Adicionar essa chave também no editor de planos do super admin.

### 9. Botão "Iniciar Conversa" em colunas de telefone
- Em `UzFormResponses.tsx`, colunas cujo `key_name` contenha `whatsapp`, `celular`, `telefone` ou `phone` ganham um botão ao lado do valor que normaliza o número (só dígitos, prefixo 55) e navega para `/crm?new_conversation_phone=...`, igual ao comportamento de `LeadsTable.tsx`.

### 10. ViaCEP
- Limpar o CEP (só dígitos) antes de medir e consultar; disparar exatamente com 8 dígitos.
- Spinner no campo durante a consulta; preencher Rua/Bairro/Cidade/Estado; erro inline "CEP não encontrado" quando a API retornar `erro: true`.

## Detalhes técnicos
- Migração: função `public.get_public_form(p_token text)` `SECURITY DEFINER`, `search_path = public`, com `GRANT EXECUTE` para `anon` e `authenticated`; retorna `jsonb` só de formulários com `is_active = true and is_deleted = false`, incluindo o texto da marca d'água do plano.
- Buckets criados pela ferramenta de storage da plataforma (não por SQL), com fallback de `createBucket()` no cliente; políticas em `storage.objects` restritas por prefixo `organization_id/` e limite de 10 MB no `form-uploads`.

- Chaves novas em `subscription_plans.limits`: `uz_forms_watermark_text` (texto) e `uz_forms_allow_custom_slug` (booleano).
- Frontend tocado: `src/pages/PublicForm.tsx`, `src/services/uzFormService.ts`, `src/components/crm/base-formularios/UzFormEditor.tsx`, `UzFormDetail.tsx`, `UzFormResponses.tsx`, e o editor de planos em `src/pages/admin/AdminPlans.tsx`.
- Ao final: `npm run build` e lista dos arquivos alterados.
