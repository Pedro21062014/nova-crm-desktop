// ── Tipos e constantes de Equipe (paridade com o CRM web) ──
// Espelha types.ts + ROLE_PRESETS/PERMISSION_METADATA do repo base (TeamManager.tsx)

export type TeamRole =
  | "superadmin"
  | "admin"
  | "manager"
  | "operator"
  | "sales"
  | "support"
  | "custom";

export interface TeamPermissions {
  products: boolean;
  orders: boolean;
  clients: boolean;
  pipeline: boolean;
  proposals: boolean;
  tasks: boolean;
  automations: boolean;
  store: boolean;
  coupons: boolean;
  loyalty: boolean;
  deliveries: boolean;
  wallet: boolean;
  ai_chat: boolean;
  team: boolean;
}

export interface TeamMember {
  id: string;
  merchantId: string;
  userId?: string;
  email: string;
  name?: string;
  role: TeamRole;
  roleTitle?: string;
  permissions: TeamPermissions;
  status: "pending" | "active" | "revoked";
  isOwner?: boolean;
  invitedBy?: string;
  invitedAt?: unknown;
  joinedAt?: unknown;
  updatedAt?: unknown;
  avatarUrl?: string;
  lastActiveAt?: unknown;
}

export interface TeamPresence {
  isOnline: boolean;
  lastSeen: unknown;
  email?: string;
  name?: string;
  avatarUrl?: string;
  currentPath?: string;
}

export interface ActiveTeamStoreInfo {
  merchantId: string;
  storeName: string;
  logoUrl?: string;
  role: string;
  roleTitle: string;
  permissions: TeamPermissions;
  invitedBy?: string;
}

export const DEFAULT_PERMISSIONS: TeamPermissions = {
  products: true,
  orders: true,
  clients: true,
  pipeline: false,
  proposals: false,
  tasks: false,
  automations: false,
  store: false,
  coupons: false,
  loyalty: false,
  deliveries: true,
  wallet: false,
  ai_chat: true,
  team: false,
};

export const ALL_PERMISSIONS_ON: TeamPermissions = {
  products: true,
  orders: true,
  clients: true,
  pipeline: true,
  proposals: true,
  tasks: true,
  automations: true,
  store: true,
  coupons: true,
  loyalty: true,
  deliveries: true,
  wallet: true,
  ai_chat: true,
  team: true,
};

export interface RolePreset {
  role: TeamRole;
  title: string;
  desc: string;
  permissions: TeamPermissions;
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    role: "admin",
    title: "Administrador",
    desc: "Acesso total a todas as áreas, finanças, catálogo e equipe.",
    permissions: ALL_PERMISSIONS_ON,
  },
  {
    role: "manager",
    title: "Gerente Geral",
    desc: "Gerencia vendas, catálogo, clientes, propostas e vitrine.",
    permissions: { ...ALL_PERMISSIONS_ON, wallet: false, team: false },
  },
  {
    role: "sales",
    title: "Vendedor & CRM",
    desc: "Foco em clientes, funil de vendas, propostas e atendimento.",
    permissions: {
      products: true,
      orders: true,
      clients: true,
      pipeline: true,
      proposals: true,
      tasks: true,
      automations: false,
      store: false,
      coupons: true,
      loyalty: true,
      deliveries: false,
      wallet: false,
      ai_chat: true,
      team: false,
    },
  },
  {
    role: "operator",
    title: "Estoquista & Pedidos",
    desc: "Controle de estoque de produtos, expedição e entregas.",
    permissions: {
      products: true,
      orders: true,
      clients: false,
      pipeline: false,
      proposals: false,
      tasks: false,
      automations: false,
      store: false,
      coupons: false,
      loyalty: false,
      deliveries: true,
      wallet: false,
      ai_chat: false,
      team: false,
    },
  },
  {
    role: "support",
    title: "Atendente de Mensagens",
    desc: "Atendimento a clientes, chat e consulta de pedidos.",
    permissions: {
      products: true,
      orders: true,
      clients: true,
      pipeline: false,
      proposals: false,
      tasks: true,
      automations: false,
      store: false,
      coupons: false,
      loyalty: false,
      deliveries: false,
      wallet: false,
      ai_chat: true,
      team: false,
    },
  },
  {
    role: "custom",
    title: "Personalizado",
    desc: "Defina manualmente as permissões de cada módulo.",
    permissions: DEFAULT_PERMISSIONS,
  },
];

export type PermissionCategory = "sales" | "catalog" | "management";

export interface PermissionMeta {
  key: keyof TeamPermissions;
  label: string;
  category: PermissionCategory;
}

export const PERMISSION_METADATA: PermissionMeta[] = [
  // Vendas & Comercial
  { key: "orders", label: "Pedidos & Vendas", category: "sales" },
  { key: "clients", label: "Clientes & CRM", category: "sales" },
  { key: "pipeline", label: "Funil de Vendas", category: "sales" },
  { key: "proposals", label: "Propostas & Orçamentos", category: "sales" },
  { key: "tasks", label: "Tarefas & Agenda", category: "sales" },
  { key: "automations", label: "Automações CRM", category: "sales" },
  // Catálogo & Vitrine
  { key: "products", label: "Produtos & Estoque", category: "catalog" },
  { key: "store", label: "Editor da Vitrine", category: "catalog" },
  { key: "coupons", label: "Cupons de Desconto", category: "catalog" },
  { key: "loyalty", label: "Programa Fidelidade", category: "catalog" },
  { key: "deliveries", label: "Entregas & Logística", category: "catalog" },
  // Gestão
  { key: "wallet", label: "Carteira & Finanças", category: "management" },
  { key: "ai_chat", label: "Chat & Atendimento", category: "management" },
  { key: "team", label: "Gerenciar Equipe", category: "management" },
];

export const CATEGORY_LABELS: Record<PermissionCategory, string> = {
  sales: "Vendas & Comercial",
  catalog: "Catálogo & Vitrine",
  management: "Gestão",
};

// Mapa rota do desktop → permissão exigida (espelha routePermissionMap do CRM)
export const ROUTE_PERMISSION_MAP: Record<string, keyof TeamPermissions> = {
  "/minha-loja": "store",
  "/produtos": "products",
  "/clientes": "clients",
  "/pedidos": "orders",
  "/cupons": "coupons",
  "/pipeline": "pipeline",
  "/propostas": "proposals",
  "/tarefas": "tasks",
  "/automacoes": "automations",
  // chat (atendimento a clientes) usa a mesma permissão que o CRM: 'clients'
  "/chat": "clients",
};

// Sanitiza e-mail para usar como ID de doc (mesma regra do CRM)
export function sanitizeDocId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "_");
}
