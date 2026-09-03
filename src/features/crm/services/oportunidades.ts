/**
 * Servicio CRM — Oportunidades. Capa de I/O para `crm_oportunidades`.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase/response";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
export type { CrmOportunidadRow, Moneda, OportunidadInput } from "@/features/crm/types/oportunidades";
import type { CrmOportunidadRow } from "@/features/crm/types/oportunidades";
import { aplicarFiltrosOportunidades, type FiltrosOportunidades } from "./oportunidadesQueryHelpers";
export {
  crearOportunidad,
  actualizarOportunidad,
  moverEtapaOportunidad,
  eliminarOportunidad,
} from "./oportunidadesMutations";

const COLS =
  "id, nombre, cliente_id, cliente_nombre, lead_id, vendedor_id, vendedor_email, etapa_id, monto_estimado, valor_real, moneda, probabilidad, fecha_estimada_cierre, fecha_cierre_real, motivo_perdida_id, modo, tipo_carga, origen, destino, notas, monto_meta, fecha_meta_cierre, compromiso_nota, margen_pct, margen_autorizado_por, margen_autorizado_at, riesgos_objeciones, cotizacion_ganadora_id, embarque_ganador_id, created_at, updated_at";

export interface ListOportunidadesParams extends FiltrosOportunidades {
  page: number;
  pageSize: number;
}

export async function listOportunidades(p: ListOportunidadesParams): Promise<{ data: CrmOportunidadRow[]; count: number }> {
  const base = supabase
    .from("crm_oportunidades")
    .select(COLS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    // EC-02: desempate estable para que la paginación no duplique ni omita
    // filas cuando varias oportunidades comparten el mismo `created_at`.
    .order("id", { ascending: false });

  const from = p.page * p.pageSize;
  const { data, count, error } = await aplicarFiltrosOportunidades(base, p)
    .range(from, from + p.pageSize - 1);
  if (error) throw error;
  return { data: (data ?? []) as CrmOportunidadRow[], count: count ?? 0 };
}

/**
 * v13.823.49 — lectura COMPLETA por lotes para la exportación CSV: respeta los
 * mismos filtros del listado y no omite coincidencias más allá de la página.
 */
export async function listOportunidadesTodas(
  p: Omit<ListOportunidadesParams, "page" | "pageSize">,
): Promise<CrmOportunidadRow[]> {
  const params: ListOportunidadesParams = { ...p, page: 0, pageSize: 0 };
  return leerTodasLasPaginas<CrmOportunidadRow>("crm.oportunidades.export", (desde, hasta) =>
    aplicarFiltrosOportunidades(
      supabase
        .from("crm_oportunidades")
        .select(COLS)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
      params,
    // SAFE-CAST: el builder de Supabase es thenable con la forma { data, error }; el tipo generado no lo expresa.
    ).range(desde, hasta) as unknown as PromiseLike<{ data: CrmOportunidadRow[] | null; error: { message: string } | null }>,
  );
}

export async function getOportunidad(id: string): Promise<CrmOportunidadRow | null> {
  // Soft-delete: el detalle por URL directa tampoco puede resolver una
  // oportunidad eliminada (la ruta muestra "no encontrada" con `null`).
  return unwrap(
    supabase
      .from("crm_oportunidades")
      .select(COLS)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
  ) as Promise<CrmOportunidadRow | null>;
}
