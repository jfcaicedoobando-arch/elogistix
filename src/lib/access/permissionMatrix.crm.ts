/**
 * Capacidades del CRM (datos puros, sin React).
 *
 * Extraído de `permissionMatrix.ts` para respetar el límite de tamaño de
 * archivo (Power of 10). Re-exportado desde el archivo original.
 */
import type { AppRole } from "@/types/appRole";
import { TENANT_ADMINS } from "./tenantAdmins";

/**
 * Ola 6 (O6.3) — Roles que configuran el CRM (`/crm/configuracion`:
 * etapas del pipeline, motivos de pérdida, metas, presupuesto). Espejo de la
 * policy "Tenant admin crm_etapas_pipeline" (migración 20260821145033) — al
 * cambiar esta lista hay que cambiar también esa policy.
 */
export const CRM_CONFIG: readonly AppRole[] = [...TENANT_ADMINS, "gerente_comercial"];

/**
 * Ola 6 (O6.1) — Roles que pueden tomar leads de la bolsa común. Espejo de
 * `public.crm_tomar_lead()` (has_any_role_in_org 'vendedor'/'admin' en la
 * organización del lead, v13.823.60) — al cambiar esta lista hay que cambiar
 * también esa RPC.
 */
export const CRM_TOMAR_LEAD: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "vendedor",
];

/**
 * v13.823.60 — Roles que gestionan CUALQUIER lead de su organización (editar,
 * eliminar, calificar, lote). Espejo de la policy "Gestion leads in-org
 * crm_leads" y de la autorización de `crm_calificar_prospecto`.
 */
export const CRM_GESTION_TODOS_LEADS: readonly AppRole[] = [
  ...TENANT_ADMINS,
  "gerente_comercial",
];

/**
 * v13.823.60 — Roles que pueden crear leads. Espejo del WITH CHECK de las
 * policies de escritura: gestión total in-org, o vendedor efectivo (que sólo
 * puede insertar un lead propio).
 */
export const CRM_CREAR_LEAD: readonly AppRole[] = [
  ...CRM_GESTION_TODOS_LEADS,
  "vendedor",
];

/**
 * Espejo EXACTO de las policies de escritura de `crm_oportunidades` y
 * `crm_actividades`: el CRUD "staff" es de administración/dirección, gerencia
 * comercial y operador. `vendedor` sólo escribe sus propios registros.
 *
 * NO reutilizar `canEdit`/`canEditCrm` para estas acciones: esos permisos son
 * amplios (operaciones + finanzas) y ofrecían formularios que la RLS rechazaba
 * (p. ej. `gerente_operaciones`). Al cambiar estas listas hay que cambiar
 * también esas policies.
 */
export const CRM_STAFF_REGISTROS: readonly AppRole[] = [
  ...TENANT_ADMINS,
  "gerente_comercial",
  "operador",
];

/** Roles que pueden crear oportunidades/actividades (staff + vendedor propio). */
export const CRM_ESCRITURA_REGISTROS: readonly AppRole[] = [
  ...CRM_STAFF_REGISTROS,
  "vendedor",
];

/**
 * Reasignar el vendedor/owner de un registro CRM: sólo quien puede gestionar
 * CUALQUIER registro. Un vendedor conserva su asignación pero no la cambia.
 */
export const CRM_REASIGNAR_VENDEDOR: readonly AppRole[] = [...CRM_STAFF_REGISTROS];
