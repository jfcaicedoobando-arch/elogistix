/**
 * Servicio de conciliación factura ↔ embarque (Ola D — /compras/conciliacion).
 *
 * Agrega los `conceptos_costo` por embarque y calcula:
 *  - `presupuestado`  = suma de montos de conceptos activos (no borrados).
 *  - `facturado`      = vínculos de facturas vigentes, sin impuestos, convertidos
 *                       a la moneda del costo con el mismo cálculo del detalle.
 *  - `pendiente`      = faltantes por concepto, con ajustes verificados
 *                       de su factura/embarque/moneda (no es saldo por pagar).
 *  - `cobertura`      = facturado / presupuestado.
 *  - `conceptos_pendientes` = conceptos sin factura o con facturación parcial.
 *  - `pendientes_tc`  = conceptos con vínculos no convertibles; no son cero real.
 *
 * Reglas:
 *  - Ignora conceptos con `deleted_at IS NOT NULL`.
 *  - Separa por moneda (MXN / USD) porque no se pueden sumar entre sí.
 *  - Ordena por mayor pendiente descendente.
 * DEFECTO 6 (P1): antes se pedía un único `.limit(CAP_REPORTE_AMPLIO)` y la UI
 * presentaba los KPIs (sumas por moneda) como TOTALES. Con más de 5000
 * conceptos activos el corte era silencioso: los KPIs y la lista quedaban
 * incompletos sin ningún aviso. Ahora se leen lotes consecutivos hasta uno
 * incompleto (mismo patrón que `fetchFacturasCxP`) y, si se alcanza el tope
 * duro `CAP_LOTES_DURO`, se lanza explícitamente en vez de mostrar un parcial.
 */
import type { Moneda } from "@/types/db";
import { supabase } from "@/integrations/supabase/client";
import { CAP_LOTES_DURO } from "@/constants/queryCaps";
import { ResultadoTruncadoError } from "@/lib/supabase/assertNotTruncated";
import { buildFilasReconciliacion, calcularPendientesConciliacion, claveGrupoConciliacion, type CCRow, type FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos.helpers";
import { fetchVinculosReconciliacion } from "@/features/embarques/services/reconciliacionCostos.lecturas";

export type EstadoConciliacion = "sin_facturar" | "parcial" | "completa" | "no_comparable" | "ajuste";

export interface EmbarqueConciliacion {
  embarque_id: string;
  expediente: string;
  cliente_nombre: string | null;
  estado: string | null;
  moneda: Moneda;
  presupuestado: number;
  facturado: number;
  pendiente: number;
  cobertura: number;
  conceptos_total: number;
  conceptos_pendientes: number;
  pendientes_tc: number;
  estado_conciliacion: EstadoConciliacion;
}

export interface FiltrosConciliacion {
  estado?: EstadoConciliacion | "todos";
  moneda?: Moneda;
  search?: string;
  organizationId?: string | null;
}

interface RowConcepto extends CCRow {
  embarque_id: string;
  monto: string | number;
  moneda: Moneda;
  estado_liquidacion: "Pendiente" | "Pagado" | string;
  embarques: {
    expediente: string | null;
    cliente_nombre: string | null;
    estado: string | null;
  } | null;
}

/** Tamaño de lote de lectura; NO es un cap — se pide en lotes hasta agotar. */
const LOTE = 1000;
interface AcumConciliacion extends EmbarqueConciliacion { sin_factura: number }

function clasificar(cobertura: number, conFactura: number, conceptosPendientes: number): EstadoConciliacion {
  if (conFactura === 0) return "sin_facturar";
  if (conceptosPendientes > 0) return "parcial";
  if (cobertura >= 0.99) return "completa";
  return "parcial";
}

function initAcc(r: RowConcepto): AcumConciliacion {
  return {
    embarque_id: r.embarque_id,
    expediente: r.embarques?.expediente ?? r.embarque_id.slice(0, 8),
    cliente_nombre: r.embarques?.cliente_nombre ?? null,
    estado: r.embarques?.estado ?? null,
    moneda: r.moneda,
    presupuestado: 0,
    facturado: 0,
    pendiente: 0,
    cobertura: 0,
    conceptos_total: 0,
    conceptos_pendientes: 0,
    pendientes_tc: 0,
    estado_conciliacion: "sin_facturar",
    sin_factura: 0,
  };
}

function agrupar(rows: RowConcepto[], filas: FilaReconciliacion[]): AcumConciliacion[] {
  const map = new Map<string, AcumConciliacion>();
  const porId = new Map(filas.map((fila) => [fila.concepto_costo_id, fila]));
  const pendientes = calcularPendientesConciliacion(filas);
  for (const r of rows) {
    const fila = porId.get(r.id);
    if (!fila) continue; // Ajustes conocidos de facturas que ya no están vigentes.
    const monto = Number(r.monto ?? 0);
    const key = claveGrupoConciliacion(r);
    let acc = map.get(key);
    if (!acc) { acc = initAcc(r); map.set(key, acc); }
    acc.presupuestado += monto;
    if (!fila.ajuste_presupuestario) acc.conceptos_total += 1;
    acc.facturado += fila.real_facturado;
    if (fila.estatus_renglon === "sin_match") acc.sin_factura += 1;
    if (fila.estatus_renglon === "no_comparable") acc.pendientes_tc += 1;
  }
  return Array.from(map, ([key, acc]) => {
    const faltantes = pendientes.get(key);
    return { ...acc, pendiente: faltantes?.pendiente ?? 0,
      conceptos_pendientes: Math.min(acc.conceptos_total, faltantes?.conceptos_pendientes ?? 0) };
  });
}

function derivarMetricas(a: AcumConciliacion): EmbarqueConciliacion {
  const { sin_factura, ...row } = a;
  const pendiente = a.conceptos_total === 0 ? 0 : a.pendiente;
  const conFactura = a.conceptos_total - sin_factura;
  const cobertura = a.presupuestado !== 0 ? a.facturado / a.presupuestado : conFactura > 0 && a.facturado === 0 ? 1 : 0;
  const estado_conciliacion = a.conceptos_total === 0 ? "ajuste" : a.pendientes_tc > 0
    ? "no_comparable"
    : clasificar(cobertura, conFactura, a.conceptos_pendientes);
  return { ...row, pendiente, cobertura, estado_conciliacion };
}

function aplicarFiltrosCliente(
  rows: EmbarqueConciliacion[],
  filtros: FiltrosConciliacion,
): EmbarqueConciliacion[] {
  let out = rows;
  if (filtros.moneda) out = out.filter((r) => r.moneda === filtros.moneda);
  if (filtros.estado && filtros.estado !== "todos") {
    out = out.filter((r) => r.estado_conciliacion === filtros.estado);
  }
  if (filtros.search) {
    const s = filtros.search.trim().toLowerCase();
    out = out.filter(
      (r) =>
        r.expediente.toLowerCase().includes(s) ||
        (r.cliente_nombre ?? "").toLowerCase().includes(s),
    );
  }
  return out;
}

/**
 * Lee TODOS los `conceptos_costo` activos que cumplan los filtros de
 * servidor, recorriendo lotes consecutivos (orden determinista por `id`)
 * hasta recibir uno incompleto. Si el acumulado alcanza `CAP_LOTES_DURO`,
 * falla explícitamente: nunca se suma dinero sobre un subconjunto.
 */
async function leerTodosLosConceptos(filtros: FiltrosConciliacion): Promise<RowConcepto[]> {
  const acumulado: RowConcepto[] = [];
  for (let offset = 0; ; offset += LOTE) {
    let q = supabase
      .from("conceptos_costo")
      .select(
        "id, embarque_id, concepto, proveedor_nombre, monto, moneda, origen, estado_liquidacion, embarques!conceptos_costo_embarque_id_fkey!inner(expediente, cliente_nombre, estado)",
      )
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + LOTE - 1);

    if (filtros.organizationId) q = q.eq("organization_id", filtros.organizationId);
    // La moneda se filtra al final: un ajuste y su asignación real pueden estar
    // en monedas distintas y deben leerse juntos para verificar su procedencia.

    const { data, error } = await q;
    // El error de cualquier lote se propaga: nunca se devuelve un resultado
    // parcial como si fuera completo.
    if (error) throw error;
    // SAFE-CAST: modelo definido por el select con embed !inner.
    const lote = (data as unknown as RowConcepto[] | null) ?? [];
    acumulado.push(...lote);
    if (acumulado.length >= CAP_LOTES_DURO) {
      throw new ResultadoTruncadoError("compras.conciliacionEmbarques", CAP_LOTES_DURO);
    }
    if (lote.length < LOTE) return acumulado;
  }
}

export async function listarConciliacionEmbarques(
  filtros: FiltrosConciliacion = {},
): Promise<EmbarqueConciliacion[]> {
  const rows = await leerTodosLosConceptos(filtros);
  const vinculos = await fetchVinculosReconciliacion(rows.map((row) => row.id), filtros.organizationId);
  const agregados = agrupar(rows, buildFilasReconciliacion(rows, vinculos)).map(derivarMetricas);
  const filtrados = aplicarFiltrosCliente(agregados, filtros);
  filtrados.sort((a, b) => b.pendiente - a.pendiente);
  return filtrados;
}
