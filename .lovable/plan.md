## Plano

Vou corrigir o Branding para que as imagens enviadas em **Admin > Configurações > Branding** apareçam automaticamente no frontend, sem depender dos arquivos fixos `/favicon.png` ou `/pwa-icon-192.png`.

### O que será ajustado

1. **Criar uma fonte única para o logo dinâmico**
   - Fazer o hook `useBranding` expor os dados salvos em Branding para os componentes.
   - Garantir fallback seguro para `/favicon.png` quando não houver logo/favicon cadastrado.

2. **Aplicar o logo salvo no Branding nas telas principais**
   - Login/Auth.
   - Sidebar do app.
   - Navbar da landing page.
   - Rodapé da landing page.
   - Layout admin desktop e mobile.
   - Banner do dashboard onde hoje ainda usa `/favicon.png` fixo.

3. **Corrigir atualização após salvar**
   - Invalidar/atualizar o cache do branding no frontend após salvar as configurações.
   - Fazer o hook buscar novamente quando houver alteração, evitando precisar editar código ou depender de hard refresh.

4. **Corrigir favicon/PWA dinâmico**
   - Ajustar `index.html` para apontar para `/favicon.png` como fallback coerente.
   - Manter o hook atualizando `<link rel="icon">`, Apple touch icon, meta tags e manifest via dados do Branding.

5. **Revisar ícones Zap restantes**
   - Trocar apenas os que representam marca/logo.
   - Manter os `Zap` funcionais de automação, gatilho, módulos, botões e indicadores, para não quebrar o significado visual da interface.

### Resultado esperado

Quando você trocar a **Logo do App**, **Favicon** ou ícones PWA no Branding e salvar, o frontend passa a refletir isso nos pontos de marca do app, navbar, login, admin e landing page.