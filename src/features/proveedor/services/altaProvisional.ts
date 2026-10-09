/**
 * Alta provisional de agentes (desde Nueva tarifa) y aprobación por Contabilidad.
 * Ambas operaciones viven en RPCs atómicas con candado de org y rol.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, run, unwrapOr } from "@/lib/supabase/response";

export interface AgenteProvisionalInput {
  nombre: string;
  pais: string;
  contacto?: string;
  email?: string;
}

export async function crearAgenteProvisional(input: AgenteProvisionalInput): Promise<string> {
  return unwrap<string>(
    supabase.rpc("crear_agente_provisional", {
      p_nombre: input.nombre.trim(),
      p_pais: input.pais.trim().toUpperCase() || "CN",
      p_contacto: input.contacto?.trim() || undefined,
      p_email: input.email?.trim() || undefined,
    }),
  );
}

export async function aprobarProveedorProvisional(proveedorId: string): Promise<void> {
  await run(supabase.rpc("aprobar_proveedor_provisional", { p_proveedor_id: proveedorId }));
}

export interface ProveedorProvisional { id: string; nombre: string }

export async function fetchProveedoresProvisionales(): Promise<ProveedorProvisional[]> {
  return unwrapOr(
    supabase
      .from("proveedores")
      .select("id, nombre")
      .eq("estado_alta", "provisional")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(50),
    [],
  ) as Promise<ProveedorProvisional[]>;
}

/** Roles que muestran la aprobación en la UI: subconjunto restringido de la autoridad existente del backend. */
export const ROLES_APRUEBAN_PROVEEDOR = ["admin", "admin_org", "contador"] as const;

export function puedeAprobarProveedor(rol: string | null | undefined): boolean {
  return (ROLES_APRUEBAN_PROVEEDOR as readonly string[]).includes(rol ?? "");
}
