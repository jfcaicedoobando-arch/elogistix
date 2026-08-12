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



/** α.1 — Default y cap defensivo para la paginación. */
const CXP_PAGE_SIZE_DEFAULT = 200;
const CXP_PAGE_SIZE_MAX = 1000;

/**
 * v13.501.0 — Antes se excluían las canceladas SIEMPRE, así que el filtro
 * "Cancelada" del panel no devolvía nada y buscar su folio (p.ej. FP-000042)
 * no encontraba una factura que sí existe. Se ocultan sólo en la vista por
 * defecto: al filtrar por "Cancelada" o al buscar texto, sí aparecen.
 */
export function incluirCanceladasCxP(filtros: FetchCxPFiltros): boolean {
  return filtros.estatus === "Cancelada" || Boolean(filtros.search?.trim());
}

/** Rango `.range()` a partir de page/pageSize con cap defensivo. */
function rangoCxP(filtros: FetchCxPFiltros): [number, number] {
  const page = Math.max(1, Math.floor(Number(filtros.page ?? 1)));
  const pageSize = Math.min(
    CXP_PAGE_SIZE_MAX,
    Math.max(1, Math.floor(Number(filtros.pageSize ?? CXP_PAGE_SIZE_DEFAULT))),
  );
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
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
  if (filtros.fecha_desde) out = out.gte("fecha_emision", filtros.fecha_desde);
  if (filtros.fecha_hasta) out = out.lte("fecha_emision", filtros.fecha_hasta);
  if (filtros.search) {
    out = out.or(orIlike(["folio_interno", "folio_proveedor", "proveedor_nombre"], filtros.search));
  }
  return out;
}

export async function fetchFacturasCxP(filtros: FetchCxPFiltros = {}): Promise<FacturaCxP[]> {
  // α.1 — Antes había .limit(2000) hardcoded → con 30 facturas/día se llenaba
  // en ~67 días y las nuevas dejaban de aparecer. Ahora paginado con .range().
  const [from, to] = rangoCxP(filtros);

  const base = supabase
    .from("proveedor_facturas")
    .select(PROVEEDOR_FACTURAS_SELECT)
    .is("deleted_at", null)
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
    .range(from, to);

  const { data, error } = await aplicarFiltrosServidor(base, filtros);
  if (error) throw error;

  // SAFE-CAST: tipo `Joined` modela el shape del select con embeds; Supabase devuelve unknown.
  const rows = ((data as unknown as Joined[] | null) ?? []).map(mapJoinedRow);

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


