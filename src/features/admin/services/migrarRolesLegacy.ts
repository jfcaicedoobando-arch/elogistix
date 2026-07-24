/**
 * Servicio: ejecuta las RPCs `migrar_roles_legacy_dry_run` y
 * `migrar_roles_legacy_ejecutar` (super_admin only).
 */
import { supabase } from "@/integrations/supabase/client";

export interface MigrarRolesLegacyItem {
  id: string;
  user_id: string;
  rol_actual: "admin" | "operador" | "viewer";
  rol_propuesto: "admin_org" | "coordinador_logistico" | "customer_service";
  organization_id?: string;
  organizacion?: string | null;
}

export interface MigrarRolesLegacyDryRun {
  total_afectados: number;
  organization_members: MigrarRolesLegacyItem[];
  user_roles: MigrarRolesLegacyItem[];
  mapa: Record<string, string>;
}

export interface MigrarRolesLegacyResult {
  ejecutado_at: string;
  total_migrados: number;
  organization_members: {
    admin_a_admin_org: number;
    operador_a_coordinador_logistico: number;
    viewer_a_customer_service: number;
  };
  user_roles: {
    admin_a_admin_org: number;
    operador_a_coordinador_logistico: number;
    viewer_a_customer_service: number;
  };
}

export async function migrarRolesLegacyDryRun(): Promise<MigrarRolesLegacyDryRun> {
  const { data, error } = await supabase.rpc("migrar_roles_legacy_dry_run");
  if (error) throw error;
  // SAFE-CAST: el contrato del RPC lo fija la migración `migrar_roles_legacy_rpcs`.
  return data as unknown as MigrarRolesLegacyDryRun;
}

export async function migrarRolesLegacyEjecutar(): Promise<MigrarRolesLegacyResult> {
  const { data, error } = await supabase.rpc("migrar_roles_legacy_ejecutar");
  if (error) throw error;
  // SAFE-CAST: contrato fijado por la RPC — ver migración.
  return data as unknown as MigrarRolesLegacyResult;
}
