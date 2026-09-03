# Diagnóstico: agendamento confirmado na tela, mas "sem evento" no Google Calendar

## Resultados dos testes (nada foi alterado)

1. **Função publicada e funcionando**: `google-calendar-book` responde (teste sem corpo → `400 Missing required fields`), com `verify_jwt = false` correto no config.
2. **Logs**: a ferramenta de logs não retorna histórico neste projeto (`function_edge_logs` / `edge_logs` vazios), então logs não servem como prova aqui.
3. **Conexão do tenant**: existe 1 conexão `google_calendar` ativa para a org `cb045d9e-…`, com token renovado hoje 20:27 UTC — token e refresh funcionam.
4. **`organization_id`**: o formulário público passa `form.organization_id`; o único form com final "calendar" (`Teste Calendar`) pertence exatamente a essa org. Correto.
5. **Teste de leitura da agenda conectada** (via `google-calendar-slots`, que consulta o freebusy da conta autorizada):
   - 03/09: nenhum horário futuro ocupado
   - **04/09: horário ocupado às 12:30Z = 09:30 (horário de Brasília)**
   - 05/09 e 08/09: nada ocupado

## Diagnóstico

O bloqueio de 04/09 às 09:30 BRT indica que **existe sim um evento na agenda primária da conta Google autorizada** — ou seja, a `google-calendar-book` muito provavelmente executou com sucesso e criou o evento. O cálculo de fuso (`toBrazilISO`) confere: o horário gravado corresponde exatamente ao slot escolhido, sem deslocamento de 3h.

Isso aponta para o cenário B: o evento está na conta Google conectada via OAuth, que **não é a conta/agenda que o tenant está olhando** (a função sempre grava em `calendars/primary` da conta autorizada).

Falta um dado seu para fechar: **em que dia e horário foi feito o agendamento de teste?** Se foi 04/09 às 09:30, está confirmado.

## Correções propostas (após sua confirmação)

1. **Escolha do calendário de destino**: hoje `primary` é fixo em `google-calendar-book`, `-slots`, `-event`, `-list`, `-update` e `-delete`. Adicionar seleção de calendário na tela da Agenda (salva na conexão) e usar esse ID em todas as funções.
2. **Mostrar a conta conectada** na página Agenda (e-mail da conta Google), para o tenant saber em qual conta os eventos caem.
3. **Feedback de erro no formulário público**: `BookingPage.handleBook` hoje só faz `console.error` no catch e nunca avisa o visitante. Verificar também `data?.error` e exibir mensagem de falha em vez da tela de confirmação.
4. **Logs úteis** em `google-calendar-book` (org, slot, status da API do Google) para diagnóstico futuro.
