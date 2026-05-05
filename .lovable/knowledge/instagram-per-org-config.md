# Memory: integrations/instagram-centralized-app

**ATUALIZADO**: A integração com o Instagram agora usa **Graph API v25.0** e suporta **11 tipos de eventos** do webhook Meta, processados pelo `instagram-webhooks` e `instagram-process-event`:

## Verificação de Seguidor (check_follower)

O step `check_follower` agora usa verificação **real** via Graph API:
1. **GET** `https://graph.facebook.com/v25.0/{IGSID}?fields=is_user_follow_business` — verifica automaticamente
2. Se `true`: fluxo continua silenciosamente (sem perguntar nada)
3. Se `false`: envia **button template** (postback `CHECK_FOLLOW_STATUS`) pedindo para seguir
4. Ao clicar no botão, re-verifica via API. Se ainda não segue, reenvia mensagem de reforço + botão
5. Cache em `instagram_leads.metadata.follower_confirmed` para pular verificação em automações futuras

## Eventos Suportados

| Evento | event_type | Dispara Automação | Descrição |
|---|---|---|---|
| messages | `dm` | ✅ | DMs recebidas (texto, áudio, imagem) |
| comments | `comment` | ✅ | Comentários em posts/reels |
| live_comments | `live_comment` | ✅ | Comentários durante lives |
| message_reactions | `reaction` | ✅ | Reações com emoji em DMs |
| messaging_postbacks | `postback` | ✅ | Cliques em botões (Quick Replies / Button Templates) |
| messaging_referral | `referral` | ✅ | Origem de anúncios/links ig.me |
| message_edit | `message_edit` | ❌ | Atualiza variável na sessão ativa |
| messaging_seen | `seen` | ❌ | Apenas analytics (persistido) |
| messaging_optins | `optin` | ❌ | Salva token de notificação recorrente |
| messaging_handover | `handover` | ❌ | Registra evento de transferência |
| standby | `standby` | ❌ | Escuta passiva multi-app |

## Ações de Automação

| Ação | Descrição |
|---|---|
| `send_dm` | Enviar DM com Private Reply / fallback |
| `ask_and_wait` | Perguntar e aguardar resposta (sessão) |
| `check_follower` | Verificar seguidor via API + button template |
| `validate_phone` | Validar telefone com confirmação |
| `save_lead` | Salvar lead + sync CRM |
| `tag_lead` | Adicionar tags ao lead + CRM |
| `reply_comment` | Responder comentário (público ou DM) com rotação de mensagens |
| `like_comment` | Curtir o comentário via Graph API |
| `openbot_start_whatsapp` | Enviar WhatsApp via OpenBot |

## Configuração por Organização

Cada cliente configura suas próprias credenciais do App Meta (App ID, App Secret). As credenciais são armazenadas criptografadas na tabela `instagram_app_config`. As Edge Functions resolvem dinamicamente com fallback para variáveis globais.

## Mapeamento de Secrets

| Nome | Descrição |
|---|---|
| `INSTAGRAM_APP_ID` | ID do app na plataforma Meta (fallback global) |
| `INSTAGRAM_APP_SECRET` | Chave secreta do app Meta (fallback global) |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Token de verificação do webhook Meta |
