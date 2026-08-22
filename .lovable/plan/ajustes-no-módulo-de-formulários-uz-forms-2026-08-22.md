# Ajustes no módulo de Formulários (uz_forms)

Antes de tudo, dois pontos verificados no código atual:

- **FIX 1 já está aplicado.** `getPublicForm()` em `uzFormService.ts` já chama `supabase.rpc("get_public_form", { p_token: token })` e `PublicForm.tsx` não importa nenhum hook de autenticação. Vou apenas revalidar abrindo a URL pública sem sessão; se ainda pedir login, o problema é a função no banco (e aí corrijo lá).
- **FIX 2 já está aplicado em parte.** O handler de CEP já limpa não-dígitos e dispara com exatamente 8 dígitos, chamando `viacep.com.br/ws/${cleanCep}/json/`. Vou testar de ponta a ponta e tratar o erro que restar (hoje qualquer falha vira "Não foi possível consultar o CEP" sem distinguir CEP inexistente de rede).

## O que será feito

### 1. URLs do formulário (FIX 3)
- A URL permanente continua sendo `/f/{token}`.
- Para o alias por slug funcionar de verdade sem inventar rota nova: a função `get_public_form` passa a aceitar o parâmetro como **token OU slug** (busca por token; se não achar, busca por slug de formulário ativo). Assim `/f/{slug}` funciona na mesma rota já existente, sem redirect.
- Na seção "Configurações do Formulário" do editor, mostrar duas linhas:
  - **URL permanente** — `origin/f/{token}`, com botão copiar, sempre visível.
  - **URL personalizada** — `origin/f/{slug}`, com botão copiar, só quando o plano permite slug e o slug está definido, com a nota: "Esta URL é um alias. A URL permanente sempre funcionará mesmo se você mudar o slug."
- Remover o campo único de URL atual, que exibia a URL de token rotulada como slug.

### 2. Edição sem travar (FIX 4)
No `UzFormEditor.tsx`, título e descrição da etapa, URL do YouTube, label e key_name do campo e o slug passam a atualizar o estado local no `onChange` e só salvar no banco no `onBlur`.

### 3. Cards de tipo de campo (FIX 5)
Rótulos com `text-center break-words leading-tight` e altura uniforme dos cards.

### 4. Labels padrão sem "Campo de" (FIX 6)
Novo campo nasce com o nome do tipo em português: Nome Completo, E-mail, Celular / WhatsApp, Texto Curto, Texto Longo, Data, Múltipla Escolha, Seleção, Upload de Arquivo, Endereço, CPF, CNPJ.

### 5. Imagem da etapa (FIX 7)
- Texto de apoio abaixo do botão de upload: "Recomendado: 1280×720px (proporção 16:9), máximo 2MB. A imagem será exibida na proporção 16:9."
- No formulário público, imagem renderizada com `aspect-video w-full object-cover rounded-lg`.

### 6. Texto "Uz4Flow" (FIX 8)
Trocar todas as ocorrências de "UzFlow" por "Uz4Flow" em placeholders e textos padrão do editor de planos.

### 7. Tela final configurável (FIX 9)
Nova seção "Tela Final" no editor, gravando em `uz_forms.settings`:
- `ending_type`: Agradecimento | WhatsApp | Ambos (padrão: agradecimento)
- `ending_message` (padrão: "Obrigado! Suas respostas foram enviadas com sucesso.")
- `ending_whatsapp_number` e `ending_whatsapp_message`, visíveis apenas nos modos com WhatsApp.

No formulário público, a tela de sucesso passa a seguir essa configuração: ícone + mensagem, botão "Falar no WhatsApp" (`wa.me/{numero}?text={mensagem}` em nova aba), ou os dois.

### 8. Marca d'água em 3 modos (FIX 10)
Em `subscription_plans.limits`:
- `uz_forms_watermark_mode`: `platform` | `custom` | `tenant_choice`
- `uz_forms_watermark_text`: usado quando o modo é `custom`

No editor de planos: seletor de modo ("Marca padrão da plataforma" / "Texto personalizado" / "Tenant escolhe") e campo de texto exibido só no modo personalizado.

Nova migração atualizando `get_public_form` para devolver `watermark_mode` e `watermark_text` do plano. No formulário público:
- `platform` → "Feito com Uz4Flow"
- `custom` → texto do plano
- `tenant_choice` → `form.settings.watermark_text`

No editor, campo "Marca d'água" nas configurações do formulário, visível só quando o plano estiver em `tenant_choice`.

## Detalhes técnicos
- Migração: nova versão de `public.get_public_form(p_token text)` (SECURITY DEFINER, `search_path = public`), aceitando token ou slug, retornando também `watermark_mode` e `watermark_text` vindos de `subscription_plans.limits` via assinatura ativa da organização; fallback para `platform`.
- Tipos: `PublicUzForm` ganha `watermark_mode`; `UzForm.settings` documenta as chaves `ending_*` e `watermark_text`.
- Arquivos previstos: `src/services/uzFormService.ts`, `src/pages/PublicForm.tsx`, `src/components/crm/base-formularios/UzFormEditor.tsx`, `src/pages/admin/AdminPlans.tsx`, `src/types/uzForm.ts` + a migração.
- Ao final: `npm run build` e lista dos arquivos alterados.
