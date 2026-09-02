/**
 * Fuente de datos del Estado de Resultados mensual.
 * Filtra embarques por ETA dentro del mes en estados contables (excluye
 * Cotización/Borrador/Cancelado — ver `ESTADOS_EMBARQUE_NO_CONTABLES`) y trae
 * TODOS los conceptos_venta / conceptos_costo asociados, paginando por lotes
 * para no truncar silenciosamente resultados por el tope implícito de
 * PostgREST (nunca se presenta un total parcial como si fuera exacto).
 */
import { supabase } from "@/integrations/supabase/client";
import { rangoMes } from "@/features/facturacion/domain/proyeccionFacturacion";
import { ESTADOS_EMBARQUE_NO_CONTABLES } from "@/features/embarques/domain/estadosContables";
import {
  buildEstadoResultados,
  type EstadoResultados,
  type EmbarqueER,
  type ConceptoVentaER,
  type ConceptoCostoER,
} from "@/features/profit/domain/estadoResultados";

interface Params {
  organizationId: string | null;
  year: number;
  month: number;
}

/** Tamaño de lote. NO es un tope de resultados: se leen lotes hasta uno incompleto. */
const BATCH_SIZE = 1000;
/** Tope duro de lotes. Si se excede, se propaga error explícito en vez de un total parcial. */
const MAX_BATCHES = 50;

type Builder<T> = { range(a: number, b: number): PromiseLike<{ data: T[] | null; error: unknown }> };

async function leerTodosLosLotes<T>(build: () => Builder<T>): Promise<T[]> {
  const acumulado: T[] = [];
  for (let batch = 0, offset = 0; ; batch += 1, offset += BATCH_SIZE) {
    if (batch >= MAX_BATCHES) {
      throw new Error(
        "LC_ESTADO_RESULTADOS_LIMITE_EXCEDIDO: se excedió el tope de lectura del Estado de Resultados",
      );
    }
    const { data, error } = await build().range(offset, offset + BATCH_SIZE - 1);
    if (error) throw error;
    const lote = data ?? [];
    acumulado.push(...lote);
    if (lote.length < BATCH_SIZE) return acumulado;
  }
}

export async function fetchEstadoResultadosMes(p: Params): Promise<EstadoResultados> {
  const { desde, hasta } = rangoMes(p.year, p.month);

  const embarques = await leerTodosLosLotes<EmbarqueER & { estado: string }>(() => {
    let q = supabase
      .from("embarques")
      .select("id, modo, tipo_cambio_usd, tipo_cambio_eur, estado")
      .gte("eta", desde)
      .lte("eta", hasta)
      .not("estado", "in", `(${ESTADOS_EMBARQUE_NO_CONTABLES.join(",")})`)
      .is("deleted_at", null)
      .order("id", { ascending: true });
    if (p.organizationId) q = q.eq("organization_id", p.organizationId);
    return q as unknown as Builder<EmbarqueER & { estado: string }>;
  });

  const ids = embarques.map((e) => e.id);
  if (ids.length === 0) {
    return buildEstadoResultados([], [], []);
  }

  const ventas = await leerTodosLosLotes<ConceptoVentaER>(() =>
    supabase
      .from("conceptos_venta")
      .select("embarque_id, descripcion, total, moneda")
      .in("embarque_id", ids)
      .is("deleted_at", null)
      .order("id", { ascending: true }) as unknown as Builder<ConceptoVentaER>,
  );

  const costos = await leerTodosLosLotes<ConceptoCostoER>(() =>
    supabase
      .from("conceptos_costo")
      .select("embarque_id, concepto, monto, moneda")
      .in("embarque_id", ids)
      .is("deleted_at", null)
      .order("id", { ascending: true }) as unknown as Builder<ConceptoCostoER>,
  );

  const embER: EmbarqueER[] = embarques.map((e) => ({
    id: e.id,
    modo: e.modo,
    tipo_cambio_usd: e.tipo_cambio_usd,
    tipo_cambio_eur: e.tipo_cambio_eur,
  }));

  return buildEstadoResultados(embER, ventas, costos);
}
