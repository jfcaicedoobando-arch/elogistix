/**
 * Lee el buzón de Pricing (Gmail) vía la función extraer-tarifas-correo y
 * convierte el correo más reciente de cada agente en filas y resumen.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchCosteoAgentes } from "@/features/costeo/services/agentes";
import { parsearCorreoProveedor, type CorreoDescargado } from "./parsearCorreoTarifas";
import { AGENTE_CLAVE, NOMBRE_PROVEEDOR, type ProveedorCorreo } from "./proveedoresCorreo";
import type { FilaCorreo } from "./comun";
import { hoyMx } from "@/lib/date/mx";

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export interface LecturaCorreos {
  filas: FilaCorreo[];
  errores: string[];
  resumen: { proveedor: string; filas: number }[];
}

export async function leerCorreos(organizationId: string): Promise<LecturaCorreos> {
  const { data, error } = await supabase.functions.invoke("extraer-tarifas-correo", { body: { organizationId } });
  if (error) throw new Error(msg(error));
  const correos = (data as { correos: CorreoDescargado[] }).correos ?? [];
  const agentes = await fetchCosteoAgentes(organizationId);
  const out: LecturaCorreos = { filas: [], errores: [], resumen: [] };
  for (const c of correos) {
    const r = await parsearCorreoProveedor(c, hoyMx());
    const clave = AGENTE_CLAVE[c.proveedor as ProveedorCorreo];
    const agente = agentes.find((a) => norm(a.nombre).includes(norm(clave ?? "")));
    for (const f of r.filas) out.filas.push({ ...f, Agente: agente?.nombre ?? clave ?? f.Agente });
    out.errores.push(...r.errores);
    out.resumen.push({ proveedor: NOMBRE_PROVEEDOR[c.proveedor as ProveedorCorreo] ?? c.proveedor, filas: r.filas.length });
  }
  return out;
}
