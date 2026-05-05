/**
 * Catálogo central de permissões granulares por menu.
 * Cada menu pode ter "actions" (lista plana) e/ou "children" (sub-menus com suas próprias actions).
 * O CRM tem um campo especial `instances_scope: "multi_select"` que armazena array de instance IDs.
 */

export type ActionDef = { key: string; label: string };
export type MenuDef = {
  key: string;
  label: string;
  actions: ActionDef[];
  children?: MenuDef[];
  instancesScope?: boolean; // se true, exibe seletor multi de instâncias
};

export const PERMISSION_TREE: MenuDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    actions: [{ key: "view", label: "Visualizar" }],
  },
  {
    key: "crm",
    label: "CRM",
    instancesScope: true,
    actions: [{ key: "view", label: "Acessar CRM" }],
    children: [
      {
        key: "conversations",
        label: "Conversas",
        actions: [
          { key: "view", label: "Ver conversas" },
          { key: "new_conversation", label: "Nova conversa" },
          { key: "send_messages", label: "Enviar mensagens" },
          { key: "schedule_message", label: "Agendar mensagem" },
          { key: "change_stage", label: "Mudar etapa do funil" },
          { key: "delete_messages", label: "Excluir mensagens" },
          { key: "delete_contact", label: "Excluir contato" },
        ],
      },
      {
        key: "quick_replies",
        label: "Respostas Rápidas",
        actions: [
          { key: "use", label: "Usar" },
          { key: "create", label: "Criar" },
          { key: "edit", label: "Editar" },
          { key: "delete", label: "Excluir" },
        ],
      },
      {
        key: "filters",
        label: "Filtros",
        actions: [
          { key: "use_filters", label: "Usar filtros" },
          { key: "filter_by_attendant", label: "Filtrar por atendente" },
        ],
      },
      {
        key: "contacts",
        label: "Contatos",
        actions: [
          { key: "view", label: "Ver lista" },
          { key: "edit", label: "Editar contato" },
          { key: "export", label: "Exportar" },
          { key: "import", label: "Importar" },
          { key: "manage_folders", label: "Gerenciar pastas" },
        ],
      },
      {
        key: "reminders",
        label: "Lembretes",
        actions: [
          { key: "view", label: "Ver lembretes" },
          { key: "create", label: "Criar" },
          { key: "edit", label: "Editar" },
          { key: "delete", label: "Excluir" },
        ],
      },
    ],
  },
  {
    key: "kanban",
    label: "Funil Kanban",
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "move_card", label: "Mover cliente de fila" },
      { key: "edit_kanban", label: "Editar Kanban" },
      { key: "create_kanban", label: "Criar Kanban" },
      { key: "export", label: "Exportar" },
      { key: "create_automation", label: "Criar automações" },
      { key: "edit_automation", label: "Editar automações" },
    ],
  },
  {
    key: "team",
    label: "Equipe",
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "manage_profiles", label: "Gerenciar perfis" },
      { key: "manage_members", label: "Gerenciar membros" },
      { key: "view_queue", label: "Ver fila de atendimento" },
    ],
  },
  {
    key: "voice",
    label: "Voice AI",
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "create_campaign", label: "Criar campanha" },
      { key: "manage_templates", label: "Gerenciar templates" },
      { key: "view_history", label: "Ver histórico" },
    ],
  },
  {
    key: "prospection",
    label: "Prospecção",
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "search", label: "Buscar leads" },
      { key: "save_to_crm", label: "Salvar no CRM" },
      { key: "configure_provider", label: "Configurar provedor" },
    ],
  },
  {
    key: "instagram",
    label: "Instagram",
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "manage_accounts", label: "Gerenciar contas" },
      { key: "manage_automations", label: "Gerenciar automações" },
      { key: "view_logs", label: "Ver logs" },
    ],
  },
  {
    key: "mcp_gateway",
    label: "MCP Gateway",
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "manage", label: "Gerenciar conexões" },
    ],
  },
  {
    key: "automation",
    label: "Automação",
    actions: [{ key: "view", label: "Acessar Automação" }],
    children: [
      {
        key: "connectors",
        label: "Conectores",
        actions: [
          { key: "view", label: "Ver" },
          { key: "create", label: "Criar" },
          { key: "edit", label: "Editar" },
          { key: "delete", label: "Excluir" },
        ],
      },
      {
        key: "flows",
        label: "Fluxos",
        actions: [
          { key: "view", label: "Ver" },
          { key: "create", label: "Criar" },
          { key: "edit", label: "Editar" },
          { key: "delete", label: "Excluir" },
          { key: "execute", label: "Executar" },
        ],
      },
      {
        key: "rules",
        label: "Regras",
        actions: [
          { key: "view", label: "Ver" },
          { key: "create", label: "Criar" },
          { key: "edit", label: "Editar" },
        ],
      },
      {
        key: "templates",
        label: "Templates",
        actions: [
          { key: "view", label: "Ver" },
          { key: "create", label: "Criar" },
          { key: "edit", label: "Editar" },
          { key: "delete", label: "Excluir" },
        ],
      },
      {
        key: "history",
        label: "Histórico",
        actions: [{ key: "view", label: "Ver" }],
      },
    ],
  },
  {
    key: "settings",
    label: "Configurações",
    actions: [
      { key: "view", label: "Visualizar" },
      { key: "ai_config", label: "Configurar IA" },
      { key: "instances", label: "Gerenciar instâncias" },
      { key: "team_credentials", label: "Credenciais de equipe" },
    ],
  },
  {
    key: "tutorials",
    label: "Tutoriais",
    actions: [{ key: "view", label: "Visualizar" }],
  },
  {
    key: "docs",
    label: "Documentação",
    actions: [{ key: "view", label: "Visualizar" }],
  },
];

export type PermissionsObject = Record<string, any>;

/**
 * Cria o objeto inicial vazio (tudo desligado) com base na árvore.
 */
export function makeEmptyPermissions(): PermissionsObject {
  const out: PermissionsObject = {};
  for (const menu of PERMISSION_TREE) {
    const node: any = {};
    for (const a of menu.actions) node[a.key] = false;
    if (menu.children) {
      for (const child of menu.children) {
        const sub: any = {};
        for (const a of child.actions) sub[a.key] = false;
        node[child.key] = sub;
      }
    }
    if (menu.instancesScope) node.instances_scope = [];
    out[menu.key] = node;
  }
  return out;
}

/**
 * Cria objeto com tudo habilitado (bom para perfis "Admin").
 */
export function makeFullPermissions(): PermissionsObject {
  const out: PermissionsObject = {};
  for (const menu of PERMISSION_TREE) {
    const node: any = {};
    for (const a of menu.actions) node[a.key] = true;
    if (menu.children) {
      for (const child of menu.children) {
        const sub: any = {};
        for (const a of child.actions) sub[a.key] = true;
        node[child.key] = sub;
      }
    }
    if (menu.instancesScope) node.instances_scope = []; // vazio = todas
    out[menu.key] = node;
  }
  return out;
}

/**
 * Mescla permissões legadas (formato antigo plano) com a nova árvore, sem perder dados.
 */
export function mergeWithTree(existing: any): PermissionsObject {
  const base = makeEmptyPermissions();
  if (!existing || typeof existing !== "object") return base;

  // Mapeamento legado → nova estrutura
  const legacyMap: Record<string, [string, string] | [string, string, string]> = {
    create_pipeline: ["kanban", "create_kanban"],
    edit_kanban: ["kanban", "edit_kanban"],
    edit_contact: ["crm", "contacts", "edit"],
    view_all_contacts: ["crm", "contacts", "view"],
    send_messages: ["crm", "conversations", "send_messages"],
    delete_conversations: ["crm", "conversations", "delete_messages"],
    manage_automations: ["automation", "view"],
    view_analytics: ["dashboard", "view"],
  };

  for (const [k, v] of Object.entries(existing)) {
    // Já está no novo formato (objeto)
    if (v && typeof v === "object" && !Array.isArray(v)) {
      base[k] = { ...(base[k] || {}), ...(v as any) };
      continue;
    }
    // Formato legado (boolean plano)
    if (typeof v === "boolean" && legacyMap[k]) {
      const path = legacyMap[k];
      if (path.length === 2) {
        base[path[0]] = { ...(base[path[0]] || {}), [path[1]]: v };
      } else {
        const [m, c, a] = path;
        base[m] = base[m] || {};
        base[m][c] = { ...(base[m][c] || {}), [a]: v };
      }
    }
  }

  // Garantir defaults úteis: se permissões legadas detectadas, ative `view` do menu pai
  for (const menu of PERMISSION_TREE) {
    const node = base[menu.key];
    if (!node) continue;
    const anyChildEnabled = Object.values(node).some(
      (v) => v === true || (v && typeof v === "object" && Object.values(v as any).some((x) => x === true))
    );
    if (anyChildEnabled && node.view === false) {
      node.view = true;
    }
  }

  return base;
}

/**
 * Helper: dado o objeto de permissões, retorna se a ação está liberada.
 * Ex: hasPermission(perms, "crm", "conversations.send_messages")
 *     hasPermission(perms, "kanban", "view")
 */
export function hasPermission(
  perms: PermissionsObject | null | undefined,
  menu: string,
  action: string
): boolean {
  if (!perms) return false;
  const node = perms[menu];
  if (!node) return false;
  if (!action.includes(".")) return Boolean(node[action]);
  const [child, sub] = action.split(".");
  return Boolean(node[child]?.[sub]);
}
