/**
 * Helpers de duplicidad de RFC para proveedores.
 * Separado de index.ts para mantener archivos ≤200 líneas (Power-of-10 #4).
 */
import { supabase } from "@/integrations/supabase/client";

/** RFCs genéricos del SAT que pueden repetirse legítimamente entre proveedores. */
export const RFC_GENERICOS_SAT = ["XEXX010101000", "XAXX010101000"] as const;

export class ProveedorDuplicadoError extends Error {
  constructor(
    public existente: { id: string; nombre: string } | null,
    public rfcNormalizado: string,
  ) {
    super(
      existente
        ? `Ya existe un proveedor con este RFC: ${existente.nombre}`
        : `Ya existe un proveedor con este RFC (${rfcNormalizado})`,
    );
    this.name = "ProveedorDuplicadoError";
  }
}

/**
 * Busca un proveedor existente por RFC normalizado dentro de la organización.
 * Devuelve null si el RFC está vacío, es un genérico SAT, o no hay match.
 * RLS adicionalmente scopea por organización del usuario actual.
 */
export async function findProveedorByRfcEnOrg(
  rfc: string,
  organizationId: string | null,
): Promise<{ id: string; nombre: string } | null> {
  const norm = rfc.trim().toUpperCase();
  if (!norm || !organizationId) return null;
  if ((RFC_GENERICOS_SAT as readonly string[]).includes(norm)) return null;
  const { data, error } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .ilike("rfc", norm)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
