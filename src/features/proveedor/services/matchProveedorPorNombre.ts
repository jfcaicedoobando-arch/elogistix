/**
 * Emparejamiento de proveedores por NOMBRE, respaldo cuando la factura no trae
 * Tax ID / RFC impreso (típico en proveedores de Asia: "HK LS LIMITED").
 *
 * Cascada: alias aprendido → nombre normalizado exacto → coincidencia parcial
 * única. Si hay ambigüedad no se vincula nada: preferimos que el operador elija.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ProveedorMatch {
  id: string;
  nombre: string;
}

export type MatchOrigen = "tax_id" | "alias" | "nombre" | "ninguno";

/** Sufijos societarios que no aportan identidad al comparar nombres. */
const SUFIJOS = [
  "S DE RL DE CV", "SA DE CV", "SAPI DE CV", "S EN C", "SC", "SA",
  "CO LTD", "COMPANY LIMITED", "LIMITED", "LTD", "LLC", "INC", "CORP",
  "CORPORATION", "GMBH", "BV", "NV", "SRL", "SL", "PTE LTD", "PTE",
  "INTERNATIONAL",
];

/**
 * Normaliza un nombre comercial: sin acentos, sin puntuación, sin sufijos
 * societarios y con espacios colapsados. "HK LS Limited." → "HK LS".
 */
export function normalizarNombreProveedor(nombre: string): string {
  let base = (nombre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Quita sufijos repetidamente ("ACME CO LTD LIMITED" → "ACME").
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const suf of SUFIJOS) {
      if (base === suf) continue;
      if (base.endsWith(` ${suf}`)) {
        base = base.slice(0, -(suf.length + 1)).trim();
        cambio = true;
      }
    }
  }
  return base;
}

async function buscarPorAlias(
  alias: string,
  organizationId: string,
): Promise<ProveedorMatch | null> {
  const { data, error } = await supabase
    .from("proveedor_alias")
    .select("proveedor_id, proveedores:proveedor_id(id, nombre, deleted_at)")
    .eq("organization_id", organizationId)
    .eq("alias_normalizado", alias)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const prov = data?.proveedores as { id: string; nombre: string; deleted_at: string | null } | null | undefined;
  if (!prov || prov.deleted_at) return null;
  return { id: prov.id, nombre: prov.nombre };
}

/**
 * Busca el proveedor de la organización cuyo nombre corresponde al extraído.
 * Devuelve `null` si no hay match claro (cero coincidencias o ambigüedad).
 */
export async function buscarProveedorPorNombreEnOrg(
  nombre: string,
  organizationId: string | null,
): Promise<{ proveedor: ProveedorMatch | null; origen: Exclude<MatchOrigen, "tax_id"> }> {
  const norm = normalizarNombreProveedor(nombre);
  if (!norm || norm.length < 3 || !organizationId) {
    return { proveedor: null, origen: "ninguno" };
  }

  try {
    const porAlias = await buscarPorAlias(norm, organizationId);
    if (porAlias) return { proveedor: porAlias, origen: "alias" };
  } catch { /* alias es opcional */ }

  const { data, error } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .limit(500);
  if (error) throw error;

  const candidatos = (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    norm: normalizarNombreProveedor(p.nombre),
  }));

  const exactos = candidatos.filter((c) => c.norm === norm);
  if (exactos.length === 1) {
    return { proveedor: { id: exactos[0].id, nombre: exactos[0].nombre }, origen: "nombre" };
  }
  if (exactos.length > 1) return { proveedor: null, origen: "ninguno" };

  const parciales = candidatos.filter(
    (c) => c.norm.length >= 3 && (c.norm.includes(norm) || norm.includes(c.norm)),
  );
  if (parciales.length === 1) {
    return { proveedor: { id: parciales[0].id, nombre: parciales[0].nombre }, origen: "nombre" };
  }
  return { proveedor: null, origen: "ninguno" };
}

/**
 * Aprende el nombre que trae el documento del proveedor para que la próxima
 * factura se empareje sola. Idempotente: ignora duplicados.
 */
export async function registrarAliasProveedor(input: {
  proveedorId: string;
  organizationId: string | null;
  nombreDocumento: string;
  userId?: string | null;
}): Promise<void> {
  const norm = normalizarNombreProveedor(input.nombreDocumento);
  if (!norm || norm.length < 3 || !input.organizationId || !input.proveedorId) return;
  const { error } = await supabase.from("proveedor_alias").insert({
    organization_id: input.organizationId,
    proveedor_id: input.proveedorId,
    alias_normalizado: norm,
    alias_original: input.nombreDocumento.slice(0, 300),
    created_by: input.userId ?? null,
  });
  // 23505 = ya existe ese alias: es el estado deseado, no un error de negocio.
  if (error && error.code !== "23505") throw error;
}
