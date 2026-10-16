/** Lecturas completas para preparar la importación de correo; no modifica catálogos. */
import { supabase } from "@/integrations/supabase/client";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
import { dedupeTiposContenedor } from "@/features/catalogos/domain";

export function fetchAgentesImportacionCorreo(organizationId: string) {
  return leerTodasLasPaginas("correo.agentes", (desde, hasta) => supabase
    .from("costeo_agentes").select("id, nombre")
    .eq("organization_id", organizationId).order("nombre").order("id").range(desde, hasta));
}

export function fetchTarifasConflictosImportacion(organizationId: string) {
  return leerTodasLasPaginas("correo.conflictos", (desde, hasta) => supabase
    .from("costeo_tarifas")
    .select("id, agente_id, naviera_id, ruta_id, tipo_contenedor_id, flete_base, vigente_desde, vigente_hasta, estado, estado_aprobacion")
    .eq("organization_id", organizationId).order("id").range(desde, hasta));
}

export async function fetchCatalogosImportacionCorreo(organizationId: string) {
  const [puertos, navieras, tipos, apagados, agentes, rutas] = await Promise.all([
    leerTodasLasPaginas("correo.puertos", (desde, hasta) => supabase
      .from("puertos").select("id, name, code, activo")
      .order("country").order("name").order("id").range(desde, hasta)),
    leerTodasLasPaginas("correo.navieras", (desde, hasta) => supabase
      .from("navieras").select("id, name, code, activo")
      .order("name").order("id").range(desde, hasta)),
    leerTodasLasPaginas("correo.tipos", (desde, hasta) => supabase
      .from("tipos_contenedor").select("id, name, code, activo, created_at")
      .order("name").order("id").range(desde, hasta)),
    leerTodasLasPaginas("correo.visibilidad", (desde, hasta) => supabase
      .from("catalogo_org_desactivado").select("catalogo, item_id")
      .eq("organization_id", organizationId).order("catalogo").order("item_id").range(desde, hasta)),
    fetchAgentesImportacionCorreo(organizationId),
    leerTodasLasPaginas("correo.rutas", (desde, hasta) => supabase
      .from("costeo_rutas").select("id, puerto_origen_id, puerto_destino_id")
      .eq("organization_id", organizationId).order("id").range(desde, hasta)),
  ]);
  const ocultos = new Set(apagados.map((r) => `${r.catalogo}:${r.item_id}`));
  const visible = (catalogo: string, r: { id: string; activo: boolean }) =>
    r.activo && !ocultos.has(`${catalogo}:${r.id}`);
  return {
    // La existencia incluye inactivos: nunca se ofrecen como un alta nueva.
    existencia: { puertos, navieras },
    validacion: {
      puertos: puertos.filter((r) => visible("puertos", r)),
      navieras: navieras.filter((r) => visible("navieras", r)),
      tipos: dedupeTiposContenedor(tipos.filter((r) => visible("tipos_contenedor", r))),
      agentes, rutas,
    },
    // Sólo comparación: incluye UUID históricos/inactivos sin sustituir los guardados.
    tiposComparacion: dedupeTiposContenedor(tipos),
  };
}
