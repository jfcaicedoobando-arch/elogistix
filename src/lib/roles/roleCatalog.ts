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
  // Legacy (no asignables desde UI, pero soportados)
  admin: "Admin (legacy)",
  operador: "Operador (legacy)",
  viewer: "Visor (legacy)",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "Acceso total a la plataforma e impersonación cross-tenant.",
  admin_org: "Dueño o gerente general de la organización. Administra usuarios, configuración y todos los módulos.",
  gerente_operaciones: "Supervisa la operación diaria. Lee finanzas y aprueba, sin tocar configuración ni usuarios.",
  gerente_visor: "Gerente en modo solo lectura. Ve toda la operación y finanzas, sin crear, editar ni aprobar.",
  gerente_comercial: "Supervisa al equipo de ventas. Ve CRM completo, cotizaciones con márgenes, clientes y comisiones de la organización; sin configuración, usuarios ni tesorería.",
  coordinador_logistico: "Opera cotizaciones, embarques y documentación. No ve márgenes ni costos internos.",
  ejecutivo_pricing: "Arma cotizaciones con costos y P&L preliminar. Visibilidad financiera limitada a sus cotizaciones.",
  contador: "Emite facturas a cliente, aprueba notas de crédito y supervisa EERR. Acceso financiero completo.",
  tesorero: "Ejecuta pagos a proveedores, conciliación bancaria y liquidación de comisiones.",
  auxiliar_contable: "Captura facturas de proveedor (XML/PDF) y las concilia contra los costos del embarque. No autoriza pagos.",
  ejecutivo_cobranza: "Da seguimiento a cartera vencida, registra promesas de pago, envía recordatorios y captura cobros recibidos. No emite facturas.",
  vendedor: "Trabaja CRM y ve embarques/cobranza de sus cuentas asignadas.",
  customer_service: "Solo lectura operativa (embarques, tracking, clientes). Sin acceso financiero.",
  cliente: "Acceso restringido al portal del cliente.",
  admin: "Rol legado. Usar Administrador en su lugar.",
  operador: "Rol legado. Usar Coordinador Logístico en su lugar.",
  viewer: "Rol legado. Usar Atención a Clientes en su lugar.",
};

export const ROLE_BADGE_CLASSES: Record<AppRole, string> = {
  super_admin: "bg-primary text-primary-foreground",
  admin_org: "bg-destructive text-destructive-foreground",
  gerente_operaciones: "bg-warning text-warning-foreground",
  gerente_visor: "bg-warning/60 text-warning-foreground",
  gerente_comercial: "bg-accent text-accent-foreground",
  coordinador_logistico: "bg-info text-info-foreground",
  ejecutivo_pricing: "bg-accent text-accent-foreground",
  contador: "bg-success text-success-foreground",
  tesorero: "bg-success text-success-foreground",
  auxiliar_contable: "bg-success/70 text-success-foreground",
  ejecutivo_cobranza: "bg-success/70 text-success-foreground",
  vendedor: "bg-success text-success-foreground",
  customer_service: "bg-muted text-muted-foreground",
  cliente: "bg-accent text-accent-foreground",
  admin: "bg-destructive/70 text-destructive-foreground",
  operador: "bg-info/70 text-info-foreground",
  viewer: "bg-muted text-muted-foreground",
};

/** Roles asignables desde la UI de administración del tenant. */
export const ASSIGNABLE_ROLES_ADMIN_ORG: readonly AppRole[] = [
  "admin_org",
  "gerente_operaciones",
  "gerente_visor",
  "gerente_comercial",
  "coordinador_logistico",
  "ejecutivo_pricing",
  "contador",
  "tesorero",
  "auxiliar_contable",
  "ejecutivo_cobranza",
  "vendedor",
  "customer_service",
];

/** Roles legacy que se conservan en BD pero no se muestran como opción nueva. */
export const LEGACY_ROLES: readonly AppRole[] = ["admin", "operador", "viewer"];

export const getRoleLabel = (role: string | null | undefined): string => {
  if (!role) return "—";
  return ROLE_LABELS[role as AppRole] ?? role;
};
