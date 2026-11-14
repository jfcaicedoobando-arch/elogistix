/**
 * Catálogo único de roles de la aplicación.
 *
 * Fuente única de verdad para etiquetas, descripciones, badges y la lista de
 * roles asignables desde la administración de usuarios. Todo nuevo rol debe
 * agregarse aquí Y al enum `public.app_role` en Postgres.
 *
 * Roles legacy (`admin`, `operador`, `viewer`) se conservan por compatibilidad
 * mientras existan registros con esos valores. Los usuarios nuevos deben
 * crearse con los roles modernos.
 */
import type { AppRole } from "@/types/appRole";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin_org: "Administrador",
  gerente_operaciones: "Gerente de Operaciones",
  gerente_visor: "Gerente Visor (solo lectura)",
  gerente_comercial: "Gerente Comercial",
  coordinador_logistico: "Coordinador Logístico",
  ejecutivo_pricing: "Ejecutivo de Pricing",
  contador: "Contador",
  tesorero: "Tesorero",
  auxiliar_contable: "Auxiliar Contable",
  ejecutivo_cobranza: "Ejecutivo de Cobranza",
  vendedor: "Vendedor / KAM",
  customer_service: "Atención a Clientes",
  cliente: "Cliente",
  agente_carga: "Agente de Carga",
  broker: "Broker (vendedor externo)",
  // Legacy (no asignables desde UI, pero soportados)
  admin: "Admin (legacy)",
  operador: "Operador (legacy)",
  viewer: "Visor (legacy)",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "Acceso total a la plataforma e impersonación cross-tenant.",
  admin_org: "Administra usuarios, configuración y catálogos de su organización.",
  gerente_operaciones: "Supervisa embarques, documentación y operación diaria. Consulta información financiera y gestiona las acciones operativas habilitadas para su rol. Sin administración de usuarios ni configuración.",
  gerente_visor: "Ve toda la operación y finanzas de la organización. No crea, edita ni aprueba nada. Ideal para auditoría o dirección.",
  gerente_comercial: "Supervisa al equipo de ventas. Ve CRM completo, cotizaciones con márgenes, clientes y comisiones. Sin tesorería ni usuarios.",
  coordinador_logistico: "Gestiona embarques, tracking y documentación. Consulta y edita costos del embarque y continúa la operación desde cotizaciones aceptadas.",
  ejecutivo_pricing: "Negocia y mantiene tarifas con partners (navieras, agentes, transportistas). Trabaja Costeo y propone overrides; el Gerente Comercial los aprueba.",
  contador: "Emite facturas a cliente, captura y aprueba facturas de proveedor, registra cobros y consulta resultados financieros. Los pagos a proveedores corresponden a Tesorería.",
  tesorero: "Ejecuta pagos a proveedores, conciliación bancaria y liquidación de comisiones. No emite facturas.",
  auxiliar_contable: "Captura facturas de proveedor (XML/PDF) y las concilia contra costos del embarque. No autoriza pagos.",
  ejecutivo_cobranza: "Da seguimiento a cartera vencida, envía recordatorios de cobro y captura cobros. No emite facturas ni autoriza pagos.",
  vendedor: "Prepara cotizaciones y consulta costos y márgenes. Gestiona sus propios leads, oportunidades y actividades, y entrega a Operaciones las cotizaciones confirmadas.",
  customer_service: "Consulta embarques y clientes; crea, edita y envía cotizaciones según su estado. Sin acceso a CRM, configuración ni módulos financieros.",
  cliente: "Acceso restringido al portal del cliente.",
  broker: "Vendedor externo: consulta sus empresas, propone prospectos y ve sus comisiones desde el Portal de Brokers. No ve datos internos.",
  agente_carga: "Acceso al portal del agente: sube tarifas marítimas, carta garantía y demoras de su propio agente. No ve datos comerciales internos.",
  admin: "Rol heredado. Revisa las tareas y los permisos antes de sustituirlo por otro rol.",
  operador: "Rol heredado. Revisa las tareas y los permisos antes de sustituirlo por otro rol.",
  viewer: "Rol heredado. Revisa las tareas y los permisos antes de sustituirlo por otro rol.",
};

export const ROLE_BADGE_CLASSES: Record<AppRole, string> = {
  super_admin: "bg-primary text-primary-foreground",
  admin_org: "bg-destructive text-destructive-foreground",
  gerente_operaciones: "bg-warning text-warning-foreground",
  gerente_visor: "bg-warning text-warning-foreground",
  gerente_comercial: "bg-accent text-accent-foreground",
  coordinador_logistico: "bg-info text-info-foreground",
  ejecutivo_pricing: "bg-accent text-accent-foreground",
  contador: "bg-success text-success-foreground",
  tesorero: "bg-success text-success-foreground",
  auxiliar_contable: "bg-success text-success-foreground",
  ejecutivo_cobranza: "bg-success text-success-foreground",
  vendedor: "bg-success text-success-foreground",
  customer_service: "bg-muted text-muted-foreground",
  cliente: "bg-accent text-accent-foreground",
  agente_carga: "bg-info text-info-foreground",
  broker: "bg-accent text-accent-foreground",
  admin: "bg-destructive text-destructive-foreground",
  operador: "bg-info text-info-foreground",
  viewer: "bg-muted text-muted-foreground",
};

/** Grupo de roles asignables, agrupados por área funcional para la UI. */
export interface RoleGroup {
  label: string;
  roles: readonly AppRole[];
}

/**
 * Grupos asignables desde la UI de administración del tenant.
 * Orden interno: del más amplio (gerencia) al más operativo.
 */
export const ASSIGNABLE_ROLE_GROUPS: readonly RoleGroup[] = [
  { label: "Administración", roles: ["admin_org"] },
  { label: "Operaciones", roles: ["gerente_operaciones", "gerente_visor", "coordinador_logistico"] },
  { label: "Comercial", roles: ["gerente_comercial", "ejecutivo_pricing", "vendedor"] },
  { label: "Finanzas", roles: ["contador", "tesorero", "auxiliar_contable", "ejecutivo_cobranza"] },
  { label: "Soporte", roles: ["customer_service"] },
];

/** Roles asignables desde la UI de administración del tenant (derivado de los grupos). */
export const ASSIGNABLE_ROLES_ADMIN_ORG: readonly AppRole[] = ASSIGNABLE_ROLE_GROUPS.flatMap(
  (g) => g.roles,
);


/** Roles legacy que se conservan en BD pero no se muestran como opción nueva. */
export const LEGACY_ROLES: readonly AppRole[] = ["admin", "operador", "viewer"];

/**
 * Orden jerárquico canónico de roles, usado para ordenar la tabla de
 * "Gestión de Usuarios" y cualquier listado donde se muestre el rol.
 * Va del más amplio (plataforma) al más restringido (cliente), y deja los
 * roles legacy al final.
 */
export const ROLE_HIERARCHY_ORDER: readonly AppRole[] = [
  "super_admin",
  ...ASSIGNABLE_ROLE_GROUPS.flatMap((g) => g.roles),
  "cliente",
  ...LEGACY_ROLES,
];

const ROLE_HIERARCHY_INDEX: Record<string, number> = ROLE_HIERARCHY_ORDER.reduce(
  (acc, role, idx) => {
    acc[role] = idx;
    return acc;
  },
  {} as Record<string, number>,
);

export const obtenerRangoRol = (role: string | null | undefined): number => {
  if (!role) return Number.MAX_SAFE_INTEGER;
  const idx = ROLE_HIERARCHY_INDEX[role];
  return idx == null ? Number.MAX_SAFE_INTEGER : idx;
};

export const obtenerEtiquetaRol = (role: string | null | undefined): string => {
  if (!role) return "—";
  return ROLE_LABELS[role as AppRole] ?? role;
};

/**
 * Mapa canónico legacy → moderno. Debe coincidir con el mapa usado por las
 * RPCs `migrar_roles_legacy_dry_run` / `_ejecutar` en la base de datos.
 */
export const LEGACY_TO_MODERN: Record<string, AppRole> = {
  admin: "admin_org",
  operador: "coordinador_logistico",
  viewer: "customer_service",
} as const;

/** Devuelve `true` si el rol es uno de los tres legacy (`admin`, `operador`, `viewer`). */
export const esRolLegacy = (role: string | null | undefined): boolean => {
  if (!role) return false;
  return (LEGACY_ROLES as readonly string[]).includes(role);
};

/** Rol moderno sugerido para un rol legacy. Devuelve `null` si el rol no es legacy. */
export const rolModernoSugerido = (role: string | null | undefined): AppRole | null => {
  if (!role) return null;
  return LEGACY_TO_MODERN[role] ?? null;
};

