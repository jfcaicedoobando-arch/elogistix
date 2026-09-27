import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks } from "@/lib/supabase/chunkedIn";
import { listActividades, type CrmActividadRow, type ListActividadesParams } from "./actividades";
import type { ActividadEntidadContexto } from "../domain/actividadEntidad";

type Tipo = "lead" | "oportunidad";
interface Nombre { id: string; nombre: string }

async function consultarNombres(tipo: Tipo, ids: string[]): Promise<Nombre[]> {
  if (tipo === "lead") {
    const { data, error } = await supabase.from("crm_leads").select("id, empresa").in("id", ids).is("deleted_at", null);
    if (error) throw error;
    return (data ?? []).map(r => ({ id: r.id, nombre: r.empresa }));
  }
  const { data, error } = await supabase.from("crm_oportunidades").select("id, nombre").in("id", ids).is("deleted_at", null);
  if (error) throw error;
  return data ?? [];
}

async function contextoTipo(tipo: Tipo, rows: CrmActividadRow[]) {
  const ids = rows.filter(a => a.entidad_tipo === tipo).map(a => a.entidad_id);
  try {
    // 100 UUIDs dejan margen para proyección/filtros bajo el límite de URL.
    const nombres = await fetchInChunks(ids, lote => consultarNombres(tipo, lote), 100);
    return { nombres: new Map(nombres.map(n => [n.id, n.nombre])), fallo: false };
  } catch {
    // Fallo parcial explícito en UI: no se oculta la agenda ni se finge borrado.
    return { nombres: new Map<string, string>(), fallo: true };
  }
}

/** Enriquece sólo la página consultada. Sin N+1 ni cambios de conteo/orden. */
export async function adjuntarEntidadesActividad(rows: CrmActividadRow[]): Promise<CrmActividadRow[]> {
  const [leads, oportunidades] = await Promise.all([contextoTipo("lead", rows), contextoTipo("oportunidad", rows)]);
  return rows.map(a => {
    const contexto = a.entidad_tipo === "lead" ? leads : a.entidad_tipo === "oportunidad" ? oportunidades : null;
    if (!contexto) return a; // Clientes/contactos históricos no tienen drilldown CRM.
    const nombre = contexto.nombres.get(a.entidad_id);
    const datos: ActividadEntidadContexto = {
      entidad_nombre: nombre ?? null,
      entidad_estado: contexto.fallo ? "error" : nombre !== undefined ? "disponible" : "no_disponible",
    };
    return { ...a, ...datos };
  });
}

/** Sólo la agenda necesita nombres: timelines y consultas existentes no añaden I/O. */
export async function listActividadesAgenda(params: ListActividadesParams) {
  const pagina = await listActividades(params);
  return { ...pagina, data: await adjuntarEntidadesActividad(pagina.data) };
}
