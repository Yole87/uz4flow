Renomear abas da página Base e Formulários

Objetivo
Atualizar os rótulos visíveis das duas abas do módulo "Base e Formulários" para refletir os novos nomes solicitados, mantendo os ícones existentes.

Mudanças
- Na aba atualmente chamada "Webhooks", alterar o texto exibido para "Via Cadastros".
- Na aba atualmente chamada "Formulários", alterar o texto exibido para "Via Uz4Forms".
- Manter os ícones `Globe` e `FileText`, respectivamente.
- Preservar os valores internos dos `TabsTrigger` (`value="webhooks"` e `value="formularios"`) e do estado `activeTab` para não afetar a lógica de renderização.

Arquivo alterado
- `src/components/crm/base-formularios/BaseFormulariosLayout.tsx`

Validação
- Verificar no preview que as abas aparecem com os novos rótulos e ícones inalterados.
- `npm run build` após a alteração para garantir que não há erros de compilação.
