# Restaurar correções perdidas dos Formulários + sincronizar link do slug

## O que aconteceu

A sincronização com o GitHub sobrescreveu o módulo de formulários com uma versão anterior. As correções feitas nos dias 22 a 25/08 foram perdidas no código atual:

- O formulário público voltou a ler a tabela diretamente (em vez de usar a função pública do backend), por isso quem não está logado vê "Formulário não encontrado ou inativo" (anexos 2 e 3). A função pública no banco continua existindo e liberada para visitantes — falta apenas o app voltar a usá-la.
- A seção "Configurações do formulário" do editor (slug personalizado, link principal, link alternativo, marca d'água, tela final) sumiu do código atual.
- O domínio do ViaCEP foi removido da política de segurança da página, então a busca de CEP volta a falhar.
- As opções de marca d'água por plano no painel Admin também foram revertidas.

## Correções

1. **Formulário público volta a abrir sem login**
   Voltar a buscar o formulário pela função pública do backend (que aceita token ou slug e já devolve a marca d'água conforme o plano), restaurando também a tela pública com quebra de linha em textos longos, máscaras (CPF/CNPJ/CEP/telefone) e tela final configurável.

2. **CEP**
   Reincluir `https://viacep.com.br` na política de segurança do `index.html`.

3. **Editor: seção de configurações**
   Restaurar slug personalizado, link principal (token), link alternativo (slug), marca d'água e tela final.

4. **Anexo 1 — link alternativo não atualiza ao salvar o slug**
   Ao salvar o slug, atualizar imediatamente o cache do formulário (mesma chave usada na tela de detalhe) para que o "Link alternativo (slug)" mostre o novo endereço sem precisar recarregar a página; se o formulário ainda não tinha slug, o bloco passa a aparecer no mesmo instante.

5. **Admin — marca d'água por plano**
   Restaurar os três modos (plataforma, personalizada, escolha do cliente) na tela de planos.

## Detalhes técnicos

Restaurar seletivamente do commit `7fe9bf5` (último estado correto antes do sync), preservando o que veio novo do GitHub:

- `src/services/uzFormService.ts` → `getPublicForm` via `supabase.rpc("get_public_form", { p_token })`.
- `src/types/uzForm.ts` → tipo `PublicUzForm` (com `watermark_mode` / `watermark_text`).
- `src/pages/PublicForm.tsx` → versão com RPC, CEP com tratamento de erro, responsividade de opções longas e tela final.
- `src/components/crm/base-formularios/UzFormEditor.tsx` → merge: manter melhorias atuais do editor e reinserir o bloco "Configurações do formulário" + "Tela final".
- `src/components/crm/base-formularios/UzFormsList.tsx` e `src/pages/admin/AdminPlans.tsx` → reaplicar as partes de slug/marca d'água.
- `index.html` → `connect-src` com `https://viacep.com.br`.
- `UzFormResponses.tsx`, `LeadsTable.tsx`, `ContactsPane.tsx`, `AppSidebar.tsx` ficam como estão (versão atual é mais recente).
- Na mutação de slug: `queryClient.setQueryData(["uz-form", form.id], ...)` + `invalidateQueries` de `["uz-form", form.id]` e `["uz-forms"]`.

Sem mudanças no banco: a função `get_public_form` e as permissões de visitante já estão corretas em produção.

## Verificação

- Abrir a URL de token e a URL de slug em janela anônima e confirmar que o formulário carrega e envia resposta.
- Consultar um CEP no formulário público publicado.
- Alterar o slug no editor e conferir que o link alternativo muda na hora.
