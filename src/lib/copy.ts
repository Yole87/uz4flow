/**
 * GLOSSÁRIO CANÔNICO — Terminologia oficial do app
 *
 * - CONTATO: pessoa cadastrada na tabela `contacts` (entidade base).
 * - LEAD: contato em qualquer estágio do funil Kanban (mesma row, contexto comercial).
 * - CONVERSA: thread de mensagens em `conversations` entre contato e empresa.
 * - CLIENTE: lead em estágio "Fechado" (ou customer=true). Usar só nesse sentido.
 * - INSTÂNCIA: conexão específica de WhatsApp/Instagram em `instances`.
 * - CANAL: tipo de comunicação (whatsapp | instagram | voice).
 *
 * Use estas constantes ao criar novos textos. Para reduzir divergência futura,
 * prefira `ACTIONS.save` em vez de hardcodar "Salvar".
 */

// Botões e ações recorrentes
export const ACTIONS = {
  save: "Salvar",
  cancel: "Cancelar",
  delete: "Excluir",
  create: "Criar",
  edit: "Editar",
  confirm: "Confirmar",
  close: "Fechar",
  back: "Voltar",
  apply: "Aplicar",
  clear: "Limpar",
  search: "Buscar",
  loading: "Carregando...",
  saving: "Salvando...",
} as const;

// Filtros "todos/todas" sempre prefixados — resolve ambiguidade da label "Todas"
export const FILTERS = {
  allChannels: "Todos os canais",
  allInstances: "Todas as instâncias",
  allStatuses: "Todos os status",
  allStages: "Todas as etapas",
  allFolders: "Todas as pastas",
  allMembers: "Todos os atendentes",
  allFields: "Todos os campos",
} as const;

// Toasts confirmatórios — verbos no pretérito, tom amigável e direto
export const TOASTS = {
  contactSaved: "Contato salvo",
  contactDeleted: "Contato excluído",
  contactUpdated: "Contato atualizado",
  conversationDeleted: "Conversa excluída",
  flowActivated: "Fluxo ativado",
  flowDeactivated: "Fluxo desativado",
  flowSaved: "Fluxo salvo",
  templateCreated: "Template criado",
  templateDeleted: "Template excluído",
  ruleCreated: "Regra criada",
  ruleDeleted: "Regra excluída",
  settingsSaved: "Configurações salvas",
  copiedToClipboard: "Copiado para a área de transferência",
} as const;
