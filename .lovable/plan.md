# Diagnóstico: agendamento confirmado na tela, mas sem evento no Google Calendar

## O que foi verificado (somente leitura)

1. **Logs da função `google-calendar-book`**: nenhum log retornado. Já a função `google-calendar-slots` mostra boots recentes (hoje 20:27 UTC). O histórico de logs analíticos (`function_edge_logs` / `edge_logs`) está retornando vazio no projeto, então o log não é prova definitiva — mas indica que a `book` não registrou execução recente.
2. **A função está publicada e responde**: chamada de teste sem corpo retornou `400 {"error":"Missing required fields"}` — ou seja, deploy e `verify_jwt = false` estão corretos.
3. **`organization_id`**: o formulário público passa `form.organization_id` para `BookingPage`, que reenvia no corpo. Existe um único formulário com final "calendar" (`Teste Calendar`, org `cb045d9e…`).
4. **Conexão em `mcp_connections`**: existe 1 conexão `google_calendar` ativa para essa mesma organização, com token renovado hoje às 20:27 UTC (`token_expiry` 21:27). Isso comprova que o fluxo de token funciona — foi a chamada de `slots` que renovou.
5. **Chamada à Google API**: sem log/resposta capturada, não é possível afirmar se retornou sucesso ou erro.

## Diagnóstico (não confirmado — precisa de 1 teste)

Os dados descartam as três causas mais óbvias: função não publicada, `organization_id` ausente e conexão/token inválidos. Restam duas hipóteses:

- **A) A chamada `google-calendar-book` nunca chegou a executar** e a tela mostrou "Agendamento confirmado" mesmo assim. Isso é possível porque `BookingPage.handleBook` só marca `booked = true` após `invoke` sem erro — mas o `catch` apenas faz `console.error`, sem mostrar nada ao usuário. Qualquer falha silenciosa fica invisível, e um retorno 2xx com corpo de erro também passaria como sucesso.
- **B) O evento foi criado, porém em outra conta/agenda** — a conexão OAuth pertence a uma conta Google diferente da que o tenant está olhando (o evento vai sempre para `calendars/primary` da conta autorizada).

## Próximo passo para confirmar (sem alterar comportamento)

1. Refazer um agendamento no formulário público com o console do navegador aberto e capturar: status da chamada `google-calendar-book`, corpo da resposta e eventual `Booking error` no console.
2. Em paralelo, listar os eventos do dia via a conexão do tenant (`google-calendar-list`) para saber se o evento existe na conta autorizada.

Com esses dois dados, o caso cai em A ou B e a correção correspondente é aplicada:
- Se A: tratar a resposta da função em `BookingPage` (verificar `data.error`, exibir mensagem de falha em vez de tela de confirmação) e adicionar logs na `google-calendar-book`.
- Se B: reconectar o Google Calendar com a conta correta e/ou permitir escolher o calendário de destino em vez de fixar `primary`.

Nada foi alterado no código ou no banco.
