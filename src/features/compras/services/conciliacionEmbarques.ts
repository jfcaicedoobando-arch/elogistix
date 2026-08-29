/**
 * Servicio de conciliación factura ↔ embarque (Ola D — /compras/conciliacion).
 *
 * Agrega los `conceptos_costo` por embarque y calcula:
 *  - `presupuestado`  = suma de montos de conceptos activos (no borrados).
 *  - `pagado`         = suma de montos con `estado_liquidacion = 'Pagado'`.
 *  - `pendiente`      = presupuestado − pagado.
 *  - `cobertura`      = pagado / presupuestado (0..1).
 *  - `conceptos_pendientes` = # de conceptos con `estado_liquidacion = 'Pendiente'`.
 *
 * Reglas:
 *  - Ignora conceptos con `deleted_at IS NOT NULL`.
 *  - Separa por moneda (MXN / USD) porque no se pueden sumar entre sí.
 *  - Ordena por mayor pendiente descendente.
 */
import { supabase } from "@/integrations/supabase/client";
import { CAP_REPORTE_AMPLIO } from "@/constants/queryCaps";

export type EstadoConciliacion = "sin_facturar" | "parcial" | "completa";

export interface EmbarqueConciliacion {
  embarque_id: string;
  expediente: string;
  cliente_nombre: string | null;
  estado: string | null;
  moneda: Moneda;
  presupuestado: number;
  pagado: number;
  pendiente: number;
  cobertura: number;
  conceptos_total: number;
  conceptos_pendientes: number;
  estado_conciliacion: EstadoConciliacion;
}

export interface FiltrosConciliacion {
  estado?: EstadoConciliacion | "todos";
  moneda?: Moneda;
  search?: string;
  organizationId?: string | null;
}

interface RowConcepto {
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

function clasificar(cobertura: number, pagado: number): EstadoConciliacion {
  if (pagado <= 0) return "sin_facturar";
  if (cobertura >= 0.99) return "completa";
  return "parcial";
}

function initAcc(r: RowConcepto): EmbarqueConciliacion {
  return {
    embarque_id: r.embarque_id,
    expediente: r.embarques?.expediente ?? r.embarque_id.slice(0, 8),
    cliente_nombre: r.embarques?.cliente_nombre ?? null,
    estado: r.embarques?.estado ?? null,
    moneda: r.moneda,
    presupuestado: 0,
    pagado: 0,
    pendiente: 0,
    cobertura: 0,
    conceptos_total: 0,
    conceptos_pendientes: 0,
    estado_conciliacion: "sin_facturar",
  };
}

function agrupar(rows: RowConcepto[]): EmbarqueConciliacion[] {
  const map = new Map<string, EmbarqueConciliacion>();
  for (const r of rows) {
    const monto = Number(r.monto ?? 0);
    const key = `${r.embarque_id}|${r.moneda}`;
    let acc = map.get(key);
    if (!acc) { acc = initAcc(r); map.set(key, acc); }
    acc.presupuestado += monto;
    acc.conceptos_total += 1;
    if (r.estado_liquidacion === "Pagado") acc.pagado += monto;
    // B-18: sólo se cuentan como "pendientes" los conceptos con ese estado
    // explícito, no cualquier estado distinto de "Pagado" (alinea con el docstring).
    if (r.estado_liquidacion === "Pendiente") acc.conceptos_pendientes += 1;
  }
  return Array.from(map.values());
}

function derivarMetricas(a: EmbarqueConciliacion): EmbarqueConciliacion {
  const pendiente = Math.max(0, a.presupuestado - a.pagado);
  const cobertura = a.presupuestado > 0 ? a.pagado / a.presupuestado : 0;
  return { ...a, pendiente, cobertura, estado_conciliacion: clasificar(cobertura, a.pagado) };
}

function aplicarFiltrosCliente(
  rows: EmbarqueConciliacion[],
  filtros: FiltrosConciliacion,
): EmbarqueConciliacion[] {
  let out = rows;
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

export async function listarConciliacionEmbarques(
  filtros: FiltrosConciliacion = {},
): Promise<EmbarqueConciliacion[]> {
  let q = supabase
    .from("conceptos_costo")
    .select(
      "embarque_id, monto, moneda, estado_liquidacion, embarques!inner(expediente, cliente_nombre, estado)",
    )
    .is("deleted_at", null)
    .limit(CAP_REPORTE_AMPLIO);

  if (filtros.organizationId) q = q.eq("organization_id", filtros.organizationId);
  if (filtros.moneda) q = q.eq("moneda", filtros.moneda);

  const { data, error } = await q;
  if (error) throw error;

  // SAFE-CAST: modelo definido por el select con embed !inner.
  const rows = ((data as unknown as RowConcepto[] | null) ?? []);
  const agregados = agrupar(rows).map(derivarMetricas);
  const filtrados = aplicarFiltrosCliente(agregados, filtros);
  filtrados.sort((a, b) => b.pendiente - a.pendiente);
  return filtrados;
}
