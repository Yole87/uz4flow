# Corrigir campo "Múltipla Escolha" no formulário público

## Problema confirmado

Em `src/pages/PublicForm.tsx` (case `multiple_choice`), cada opção é um botão que faz
`handleFieldChange(field.key_name, opt)` — ou seja, substitui o valor anterior. O marcador
é redondo (estilo radio). Resultado: comporta-se igual ao campo "Lista de Seleção",
permitindo apenas uma opção.

## O que será feito

1. **Seleção múltipla real**
   - O valor do campo passa a ser uma lista de opções guardada como texto separado por
     vírgula (`"Opção A, Opção B"`), mantendo compatibilidade com o formato atual de
     `response_data` (string por chave) e com a tabela de respostas.
   - Clicar em uma opção alterna (adiciona/remove) em vez de substituir.
   - Opções selecionadas mantêm a ordem definida no editor.

2. **Visual coerente com multisseleção**
   - Marcador quadrado (checkbox) com ícone de check no lugar do círculo tipo radio.
   - Mantém o mesmo estilo de card, cores e a quebra de texto responsiva já corrigida.

3. **Validação**
   - Campo obrigatório: válido quando houver ao menos uma opção marcada.
   - Erro limpo assim que a primeira opção for selecionada.

## Fora de escopo

- "Lista de Seleção" (`select_list`) continua single-select, como esperado.
- Sem mudanças no banco, RLS ou edge functions.
- A tabela de respostas já trata valores com vírgula nos filtros de opções, então não
  requer alteração.

## Arquivos

- `src/pages/PublicForm.tsx` — renderização, toggle e validação do `multiple_choice`.

## Validação

- Build (`npm run build`).
- Teste no formulário público: marcar/desmarcar várias opções, validar obrigatoriedade e
  conferir a resposta gravada na aba Respostas.
