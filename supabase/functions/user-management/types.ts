/**
 * Tipos compartidos entre handlers de `user-management`.
 * Extraído de `handlers.ts` para respetar el límite Power-of-10 (<200 líneas).
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface HandlerCtx {
  req: Request;
  cors: Record<string, string>;
  log: { finish: (status: number, event: string, meta?: Record<string, unknown>) => void };
  callerId: string;
  adminClient: SupabaseClient;
  body: Record<string, unknown>;
}

export interface AdminAccess {
  isGlobalAdmin: boolean;
  orgId: string | null;
}

// Catálogo completo de roles asignables (modernos + legacy para retro-compat).
// Mantener sincronizado con `ASSIGNABLE_ROLES_ADMIN_ORG` en src/lib/roles/roleCatalog.ts
// y con el enum `public.app_role`.
export const VALID_ROLES = [
  // Modernos
  "admin_org",
  "gerente_operaciones",
  "gerente_visor",
  "gerente_comercial",
  "coordinador_logistico",
  "ejecutivo_pricing",
  "contador",
  "auxiliar_contable",
  "ejecutivo_cobranza",
  "tesorero",
  "vendedor",
  "customer_service",
  // Legacy
  "admin",
  "operador",
  "viewer",
] as const;

// Roles que un admin_org (no global) puede asignar. Excluye `admin` y cualquier
// rol con escalado a privilegios globales — corrige privilege escalation
// reportado por el escáner de seguridad.
export const ASSIGNABLE_BY_ORG_ADMIN = new Set<string>([
  "admin_org",
  "gerente_operaciones",
  "gerente_visor",
  "gerente_comercial",
  "coordinador_logistico",
  "ejecutivo_pricing",
  "contador",
  "auxiliar_contable",
  "ejecutivo_cobranza",
  "tesorero",
  "vendedor",
  "customer_service",
  "operador",
  "viewer",
]);
