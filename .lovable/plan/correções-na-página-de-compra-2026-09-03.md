# Correções na Página de Compra

## 1. Imagem do produto por upload
No configurador de produtos (Tela Final), trocar o campo "URL da imagem" por um botão de upload igual ao usado nos passos do formulário: envio para o bucket `form-images` (limite 2MB, caminho `form.id/uuid.ext`), preview da imagem enviada, botão para remover. A URL pública retornada é gravada em `product.image_url`.

## 2. Countdown por duração em horas
- Tipo: `purchase_countdown_to` (data/hora) passa a ser `purchase_countdown_hours` (número de horas).
- Editor: campo numérico (min 1, max 300, passo 1), placeholder "Ex: 24", label "Duração da oferta (horas)", descrição "O contador começa quando o visitante abre a página de compra." Vazio = sem contador.
- Página de compra: prop `countdownHours`; alvo calculado uma única vez no mount (`useMemo` com `[]`) como agora + horas.
- Formulário público: lê `purchase_countdown_hours` e repassa como `countdownHours`.
- Formulários antigos com data salva simplesmente não exibem contador até o tenant informar as horas.

## 3. Badge de destaque mais chamativo
- Badge: `px-6 py-1.5`, `text-sm font-extrabold uppercase tracking-wide`, `shadow-lg`, ícone `Star` (`h-3.5 w-3.5 inline mr-1 fill-current`) antes do texto.
- Card destacado: borda `border-[3px]` e brilho `shadow-lg shadow-primary/30`.

## 4. Prefixo De/Por duplicado
- Remover os prefixos fixos "De:" e "Por:" na renderização — exibir apenas o texto digitado pelo tenant.
- Editor: labels "Preço original (riscado)" e "Preço promocional"; placeholders "R$10,00 (preço original)" e "R$5,00 (preço com desconto)".

## Arquivos
- `src/types/uzForm.ts`
- `src/components/crm/base-formularios/UzFormEditor.tsx`
- `src/components/forms/PurchasePage.tsx`
- `src/pages/PublicForm.tsx`

Sem alterações de banco ou edge functions. Observação: o Git é gerenciado pela plataforma, então não executo commit manualmente.
