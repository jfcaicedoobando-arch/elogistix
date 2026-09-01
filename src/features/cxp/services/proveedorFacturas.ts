/**
 * Services CxP — Cuentas por Pagar a proveedores.
 *
 * Lista facturas de proveedor con saldo calculado (vía v_proveedor_facturas_saldo),
 * KPIs (por pagar / vencido / por vencer 7d) y CRUD básico.
 *
 * Lógica pura (clasificación, mapeo, filtros cliente) en `./proveedorFacturas.helpers`.
 */
import { supabase } from "@/integrations/supabase/client";
import { orIlike } from "@/lib/search/ilike";
import {
  PROVEEDOR_FACTURAS_SELECT,
  mapJoinedRow,
  aplicarFiltrosCliente,
  type Joined,
} from "./proveedorFacturas.helpers";
import type { FacturaCxP, FetchCxPFiltros } from "./proveedorFacturas.types";

export type {
  ProveedorFacturaRow,
  EstatusCxP,
  FacturaCxP,
  FetchCxPFiltros,
} from "./proveedorFacturas.types";



/**
 * Tamaño de lote de lectura. NO es un cap: `fetchFacturasCxP` pide lotes
 * consecutivos hasta recibir uno incompleto, así que el resultado siempre
 * contiene todas las filas que cumplen los filtros.
 */
const CXP_BATCH_SIZE = 1000;

/**
 * v13.501.0 — Antes se excluían las canceladas SIEMPRE, así que el filtro
 * "Cancelada" del panel no devolvía nada y buscar su folio (p.ej. FP-000042)
 * no encontraba una factura que sí existe. Se ocultan sólo en la vista por
 * defecto: al filtrar por "Cancelada" o al buscar texto, sí aparecen.
 */
export function incluirCanceladasCxP(filtros: FetchCxPFiltros): boolean {
  return filtros.estatus === "Cancelada" || Boolean(filtros.search?.trim());
}

interface QueryFiltrable<Q> {
  eq(col: string, val: string): Q;
  neq(col: string, val: string): Q;
  gte(col: string, val: string): Q;
  lte(col: string, val: string): Q;
  or(expr: string): Q;
}

/** Aplica al servidor los filtros que Postgres puede resolver. */
function aplicarFiltrosServidor<Q extends QueryFiltrable<Q>>(q: Q, filtros: FetchCxPFiltros): Q {
  let out = q;
  if (!incluirCanceladasCxP(filtros)) out = out.neq("estado", "Cancelada");
  if (filtros.proveedor_id && filtros.proveedor_id !== "todos") {
    out = out.eq("proveedor_id", filtros.proveedor_id);
  }
  if (filtros.categoria_presupuesto_id && filtros.categoria_presupuesto_id !== "todas") {
    out = out.eq("categoria_presupuesto_id", filtros.categoria_presupuesto_id);
  }
  if (filtros.moneda && filtros.moneda !== "todas") out = out.eq("moneda", filtros.moneda);
  // `estado_aprobacion` es columna directa: filtrarla en servidor no altera la
  // semántica de `aplicarFiltrosCliente` y reduce filas transferidas.
  if (filtros.aprobacion && filtros.aprobacion !== "todos") {
    out = out.eq("estado_aprobacion", filtros.aprobacion);
  }
  if (filtros.fecha_desde) out = out.gte("fecha_emision", filtros.fecha_desde);
  if (filtros.fecha_hasta) out = out.lte("fecha_emision", filtros.fecha_hasta);
  if (filtros.search) {
    out = out.or(orIlike(["folio_interno", "folio_proveedor", "proveedor_nombre"], filtros.search));
  }
  return out;
}

/**
 * Lee TODAS las facturas que cumplen los filtros resolubles por servidor.
 *
 * Antes esta función pedía un solo `.range()` de 200 filas y luego aplicaba
 * los filtros derivados (estatus/origen) en memoria: las facturas posteriores
 * a la 200 nunca se veían, un filtro cuya única coincidencia estaba después
 * decía "sin resultados" y los KPIs salían incompletos. Ahora recorre lotes
 * consecutivos hasta recibir uno incompleto, con orden determinista
 * (`fecha_vencimiento`, desempate por `id`) para no omitir ni duplicar filas
 * entre rangos cuando varias comparten fecha.
 */
async function leerTodosLosLotes(filtros: FetchCxPFiltros): Promise<Joined[]> {
  const acumulado: Joined[] = [];
  for (let offset = 0; ; offset += CXP_BATCH_SIZE) {
    const base = supabase
      .from("proveedor_facturas")
      .select(PROVEEDOR_FACTURAS_SELECT)
      .is("deleted_at", null)
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + CXP_BATCH_SIZE - 1);

    const { data, error } = await aplicarFiltrosServidor(base, filtros);
    // El error de cualquier lote se propaga: nunca devolvemos un resultado
    // parcial como si fuera completo.
    if (error) throw error;
    // SAFE-CAST: `Joined` modela el shape del select con embeds; Supabase devuelve unknown.
    const lote = (data as unknown as Joined[] | null) ?? [];
    acumulado.push(...lote);
    if (lote.length < CXP_BATCH_SIZE) return acumulado;
  }
}

export async function fetchFacturasCxP(filtros: FetchCxPFiltros = {}): Promise<FacturaCxP[]> {
  const rows = (await leerTodosLosLotes(filtros)).map(mapJoinedRow);
  // Los filtros derivados (estatus/origen) se aplican sobre el conjunto
  // completo, no sobre el primer lote.
  return aplicarFiltrosCliente(rows, filtros);
}


/**
 * Lee una factura individual con el mismo shape `FacturaCxP` que la lista.
 * Permite que el diálogo de detalle observe datos frescos vía React Query
 * aunque la lista filtrada haya descartado la fila (p.ej. al cambiar el
 * estado_aprobacion de "pendiente" a "aprobada" bajo el filtro "Por aprobar").
 */
export async function fetchFacturaProveedor(id: string): Promise<FacturaCxP | null> {
  const { data, error } = await supabase
    .from("proveedor_facturas")
    .select(PROVEEDOR_FACTURAS_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // SAFE-CAST: mismo shape `Joined` validado por el select de arriba.
  return mapJoinedRow(data as unknown as Joined);
}

export { calcularKPIsCxP, type KPIsCxP } from "./cxpKpis";

export {
  crearFacturaProveedor,
  existeFacturaDuplicada,
  buscarFacturaDuplicadaFolio,

  buscarFacturaPorUuidFiscalResultado,
  type BusquedaUuidFiscal,
  type FacturaExistentePorUuid,

  softDeleteFacturaProveedor,
  type NuevaFacturaProveedorPayload,
} from "./proveedorFacturas.crud";


