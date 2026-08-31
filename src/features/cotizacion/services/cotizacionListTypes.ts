/**
 * YG-03: tipos del listado de Cotizaciones, desacoplados del hook
 * `useCotizaciones()` (que ya no trae el set completo — la paginación es
 * server-side). Antes `CotizacionListItem` se inferia de `useCotizaciones`;
 * ahora es la fuente de verdad y `useCotizaciones` puede tipar contra él.
 */

/** Segmento comercial: separa la prospección (CRM) de la operación con clientes. */
export type SegmentoCotizacion = "clientes" | "prospectos" | "todas";

/** Fila aplanada del listado (`COTIZACION_LIST_COLUMNS` + agregados). */
export interface CotizacionListItem {
  id: string;
  folio: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  es_prospecto: boolean | null;
  prospecto_empresa: string | null;
  modo: string;
  origen: string | null;
  destino: string | null;
  subtotal: number | null;
  moneda: string | null;
  estado: string;
  fecha_vigencia: string | null;
  created_at: string | null;
  descripcion_mercancia: string | null;
  conceptos_venta: unknown;
  tipo_documento: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  sin_desglose_costos: boolean | null;
  estado_revalidacion: string | null;
  origen_portal: boolean | null;
  tarifa_id: string | null;
  embarque_id: string | null;
  /** Aplanado de `cotizacion_costos(count)`. */
  cotizacion_costos_count: number;
  /** Aplanado de `costeo_tarifas:tarifa_id(vigente_hasta)`. */
  tarifa_vigente_hasta: string | null;
}
