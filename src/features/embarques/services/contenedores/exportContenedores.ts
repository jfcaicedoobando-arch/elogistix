import { supabase } from "@/integrations/supabase/client";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";

type EmbarqueExport = { id: string; contenedor: string | null; tipo_contenedor: string | null };
export type ContenedorExport = { id: string; embarque_id: string; numero_contenedor: string | null; tipo_contenedor: string | null; orden: number };
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/** One row per shipment; aligned lists preserve every child's number and type. */
export function resumirContenedoresExport(embarques: EmbarqueExport[], hijos: ContenedorExport[], tipos: Record<string, string>) {
  const map: Record<string, { contenedor: string; tipo_contenedor: string }> = {};
  const porEmbarque = new Map<string, ContenedorExport[]>();
  // Stable IDs avoid duplicates when live pagination overlaps after an insert.
  for (const c of new Map(hijos.map(h => [h.id, h])).values()) {
    const grupo = porEmbarque.get(c.embarque_id) ?? [];
    grupo.push(c);
    porEmbarque.set(c.embarque_id, grupo);
  }
  for (const e of embarques) {
    const activos = (porEmbarque.get(e.id) ?? []).sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id));
    if (!activos.length && !e.contenedor && !e.tipo_contenedor) {
      map[e.id] = { contenedor: "", tipo_contenedor: "" };
      continue;
    }
    const filas = activos.length ? activos : [{ numero_contenedor: e.contenedor, tipo_contenedor: e.tipo_contenedor }];
    const etiqueta = (valor: string | null) => !valor ? "Pendiente" : tipos[valor] || (UUID.test(valor) ? "Tipo sin identificar" : valor);
    map[e.id] = {
      contenedor: filas.map(c => c.numero_contenedor || "Pendiente").join("; "),
      tipo_contenedor: filas.map(c => etiqueta(c.tipo_contenedor)).join("; "),
    };
  }
  return map;
}

/** Reads children for ALL exported IDs, independently of the visible UI page. */
export async function fetchContenedoresParaExport(embarques: EmbarqueExport[], organizationId: string | null) {
  if (!organizationId) throw new Error("Selecciona una organización antes de exportar.");
  const hijos: ContenedorExport[] = [];
  for (let offset = 0; offset < embarques.length; offset += 100) {
    const ids = embarques.slice(offset, offset + 100).map(e => e.id);
    hijos.push(...await leerTodasLasPaginas("embarques.contenedores.export", (desde, hasta) => supabase
      .from("embarque_contenedores")
      .select("id, embarque_id, numero_contenedor, tipo_contenedor, orden")
      .eq("organization_id", organizationId).in("embarque_id", ids).is("deleted_at", null)
      .order("id", { ascending: true }).range(desde, hasta)));
  }
  const idsTipo = [...new Set([...hijos.map(c => c.tipo_contenedor), ...embarques.map(e => e.tipo_contenedor)]
    .filter((id): id is string => !!id && UUID.test(id)))];
  const tipos: Record<string, string> = {};
  for (let offset = 0; offset < idsTipo.length; offset += 100) {
    const { data, error } = await supabase.from("tipos_contenedor").select("id, code, name").in("id", idsTipo.slice(offset, offset + 100));
    if (error) throw error;
    for (const tipo of data ?? []) tipos[tipo.id] = tipo.code || tipo.name;
  }
  return resumirContenedoresExport(embarques, hijos, tipos);
}
