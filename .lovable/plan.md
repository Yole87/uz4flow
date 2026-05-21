# Corrigir envio de PDF na automação do Instagram → WhatsApp

## Problema

Na automação do Instagram que dispara um envio de WhatsApp via OpenBot (DigitalBotIA), quando o arquivo anexado é uma **imagem**, o ciclo completa normalmente. Quando o arquivo é um **PDF** (ou outro documento), a automação não finaliza o envio no WhatsApp.

## Causa

No envio para o OpenBot dentro de `supabase/functions/instagram-process-event/index.ts` (por volta da linha 2346–2383), o payload só inclui:

- `arquivo` (data URL base64)
- `fileName`

Faltam dois detalhes que o OpenBot/Baileys precisa para tratar documentos:

1. Campo `mimetype` no nível raiz do payload — sem ele, o provedor não reconhece o anexo como documento (PDF/DOCX/XLSX) e descarta o envio. Para imagem ele consegue inferir pelo data URL, por isso "passa".
2. A conversão para base64 usa um laço `String.fromCharCode` byte a byte, que é lento e instável para arquivos maiores (PDFs costumam ser bem maiores que imagens). O resto do projeto já usa um helper `arrayBufferToBase64` em blocos.

Outros pontos do sistema que enviam PDF via OpenBot (ex.: `openbot-webhook/index.ts` linhas 2158–2163) **já enviam** `arquivo` + `mimetype` + `fileName` juntos — esse é o padrão correto.

## Correção

Em `supabase/functions/instagram-process-event/index.ts`, no bloco que monta o `sendPayload` para o OpenBot quando há `file_storage_path`:

- Adicionar `sendPayload.mimetype = mimeType` junto com `arquivo` e `fileName`.
- Substituir a conversão base64 byte-a-byte por uma função em chunks (mesmo padrão de `arrayBufferToBase64` já usado em `openbot-webhook`), para PDFs maiores serem codificados sem travar.
- Manter `desativarFluxo: true` e o restante do fluxo intacto.

Nenhuma alteração em UI, banco de dados ou outras funções é necessária — é uma correção pontual no payload de saída.

## Validação

1. Criar/editar automação no Instagram com um PDF anexado.
2. Disparar o gatilho (DM/comentário conforme configurado).
3. Confirmar nos logs da função `instagram-process-event` o `File attached: <nome>.pdf` e resposta 200 do OpenBot.
4. Confirmar no WhatsApp do contato a chegada da mensagem + PDF.
5. Re-testar com uma imagem para garantir que o caminho anterior não regrediu.
