export const usuarios = {
  all: ['usuarios'] as const,
} as const;

export const usuariosPortalCliente = {
  all: ['usuarios-portal-cliente'] as const,
} as const;

export const usuariosPortalAgente = {
  all: ['usuarios-portal-agente'] as const,
} as const;

export const planes = {
  all: ['planes'] as const,
} as const;

export const admin = {
  organizations: ['admin-organizations'] as const,
  organizationsStats: ['admin-organizations', 'stats'] as const,
  allUsers: ['admin-all-users'] as const,
  allUsersOptions: ['admin-all-users', 'options'] as const,
  org: (id: string) => ['admin-org', id] as const,
  orgMembers: (id: string) => ['admin-org-members', id] as const,
  orgCountMembers: (id: string) => ['admin-org-count-members', id] as const,
  orgCountEmbarques: (id: string) => ['admin-org-count-embarques', id] as const,
  orgCountClientes: (id: string) => ['admin-org-count-clientes', id] as const,
  orgCountCotizaciones: (id: string) => ['admin-org-count-cotizaciones', id] as const,
  organizationsList: ['admin', 'organizations-list'] as const,
  orgActivity: ['admin', 'org-activity'] as const,
  recentOrgs: ['admin', 'recent-orgs'] as const,
  recentOrgsList: (limit: number) => ['admin', 'recent-orgs', limit] as const,
  migrarRolesLegacyDryRun: ['admin', 'migrar-roles-legacy', 'dry-run'] as const,
  orgMembersAll: ['admin-org-members'] as const,
} as const;

export const appLogs = {
  all: ['app_logs'] as const,
  list: (filters: Record<string, unknown>) => ['app_logs', filters] as const,
  fnList: ['app_logs', 'fn_list'] as const,
  healthSummary: (hours: number) => ['app_logs_health_summary', hours] as const,
  healthTimeline: (hours: number, buckets: number) =>
    ['app_logs_health_timeline', hours, buckets] as const,
} as const;

export const papelera = Object.assign(
  (tabla: string) => ['papelera', tabla] as const,
  { counts: ['papelera', 'counts'] as const },
);
export const idempotenciaLog = ['idempotencia-log'] as const;

export const alertasSistema = {
  pending: ['alertas-sistema', 'pending-count'] as const,
  listAll: ['alertas-sistema', 'list'] as const,
  list: (includeAcknowledged = false) =>
    ['alertas-sistema', 'list', includeAcknowledged] as const,
} as const;

export const demoLeads = {
  all: ['admin', 'demo-leads'] as const,
} as const;
