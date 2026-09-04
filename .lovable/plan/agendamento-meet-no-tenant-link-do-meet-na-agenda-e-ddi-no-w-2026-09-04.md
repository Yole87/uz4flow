# Agendamento: Meet no tenant, link do Meet na Agenda e DDI no WhatsApp

## Estado atual verificado

- O e-mail da conta Google **já está implementado**: `useGoogleCalendar` chama `google-calendar-account` e expõe `accountEmail`; `GoogleCalendarSettings.tsx` (linha ~270) e `Agenda.tsx` (linha ~113) já renderizam "Conectado como: …". Falta apenas o fallback quando a função falha.
- Em `Agenda.tsx` já existe um badge "Meet" quando `event.hangoutLink` existe, mas **não** há o link visível com botão de copiar.
- `BookingPage.tsx` tem hoje o toggle "Incluir Google Meet" e `includeMeet` como estado local do visitante, além de um input simples de WhatsApp.
- `UzFormSettings` não possui `calendar_include_meet`.

## 1. E-mail da conta conectada (ajuste pequeno)

- Em `useGoogleCalendar`, logar no console o erro da função (`console.error`) em vez de engolir silenciosamente, e devolver `null`.
- Em `GoogleCalendarSettings.tsx` e `Agenda.tsx`: quando conectado e sem e-mail resolvido, exibir "Conta conectada" como texto de fallback abaixo do badge.

## 2. Google Meet passa a ser configuração do tenant

- `src/types/uzForm.ts`: adicionar `calendar_include_meet?: boolean` a `UzFormSettings`.
- `UzFormEditor.tsx`: no `endingDraft`, adicionar `calendar_include_meet: !!settings.calendar_include_meet`; e, na seção do ending `calendar`, logo após "Antecedência mínima", incluir um bloco com `Switch` "Google Meet" / "Criar link de videoconferência em todos os agendamentos", atualizando o draft e chamando `saveSetting("calendar_include_meet", v)`.
- `PublicForm.tsx`: ler `const calendarIncludeMeet = !!formSettingsRaw.calendar_include_meet;` e passar `includeMeet={calendarIncludeMeet}` para `BookingPage`.
- `BookingPage.tsx`: remover o estado `includeMeet`, o toggle e os imports não usados (`Switch`, `Video`); adicionar prop `includeMeet?: boolean` e enviar esse valor no body do invoke de `google-calendar-book`.

## 3. Link do Meet na listagem da /agenda

Em `Agenda.tsx`, abaixo da descrição do evento, quando `event.hangoutLink` existir, exibir o link (`<a>` com `target="_blank"`, truncado, cor primária) e um botão ícone `Copy` que copia o link com toast de confirmação. Importar `Copy` do lucide-react. O badge "Meet" existente permanece.

## 4. Campo WhatsApp com seletor de DDI

Em `BookingPage.tsx`, substituir o input simples por um campo composto:

- Botão à esquerda (dentro de um `Popover`) com bandeira emoji + DDI, padrão 🇧🇷 +55.
- Dropdown com campo de busca filtrando por nome do país ou DDI, listando os 16 países indicados (Brasil primeiro).
- Input numérico à direita apenas com o número; o valor enviado é `${ddi}${somenteDigitos}`.
- `preFillPhone`: detectar DDI no início (ex.: `+55`) e remover, aplicando o restante no input e selecionando o país correspondente.

## Notas técnicas

- Tudo com tokens do design system, sem cores fixas; componentes shadcn já existentes (`Popover`, `Command`/`Input`, `Switch`, `Button`).
- Nenhuma alteração de Edge Function é necessária: `google-calendar-book` já aceita `include_meet`.
- Verificação final com typecheck. Git é gerenciado pela plataforma (sem push).
