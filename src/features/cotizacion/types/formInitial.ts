/** Datos persistidos usados para rehidratar el formulario y sus costos al editar. */
import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from "./core";

export interface CotizacionInitialData {
  id: string;
  estado: string;
  folio: string;
  es_prospecto: boolean;
  cliente_id: string | null;
  /** P0: vínculo CRM real; se restaura al editar para no dejarla huérfana. */
  oportunidad_id?: string | null;
  pricing_solicitud_id?: string | null;
  organization_id?: string | null;
  /** A1/A7: moneda persistida; se conserva como moneda del vínculo al editar. */
  moneda?: string | null;
  /** 13.823.281: TC USD/MXN congelado (sólo para el encabezado de una cotización mixta). */
  tipo_cambio_usd?: number | null;
  prospecto_empresa: string;
  prospecto_contacto: string;
  prospecto_email: string;
  prospecto_telefono: string;
  modo: string;
  tipo: string;
  incoterm: string;
  tipo_carga: string;
  sector_economico: string;
  descripcion_mercancia?: string;
  descripcion_adicional: string;
  tipo_embarque: string;
  tipo_contenedor: string | null;
  tipo_peso: string;
  dimensiones_lcl: DimensionLCL[];
  dimensiones_aereas: DimensionAerea[];
  peso_kg: number;
  peso_fisico_kg?: number | null;
  volumen_m3: number;
  piezas: number;
  tipo_unidad: string | null;
  origen: string;
  destino: string;
  /** Etapa 3 — IDs de catálogo persistidos (null en cotizaciones legacy). */
  puerto_origen_id?: string | null;
  puerto_destino_id?: string | null;

  tiempo_transito_dias: number | null;
  frecuencia: string;
  ruta_texto: string;
  validez_propuesta: string | null;
  tipo_movimiento: string;
  seguro: boolean;
  valor_seguro_usd: number;
  dias_libres_destino: number;
  dias_almacenaje: number;
  carta_garantia: boolean;
  notas: string | null;
  num_contenedores: number;
  conceptos_venta: ConceptoVentaCotizacion[];
  msds_archivo: string | null;
  modalidad_equipo?: string | null;
  punto_intermedio?: string | null;
  tarifa_id?: string | null;
  tarifa_override?: unknown;
  sin_desglose_costos?: boolean;
  lcl_tarifa_wm?: number | null;
  lcl_minimo_flete?: number | null;
  lcl_dias_libres_almacenaje?: number | null;
  lcl_consolidador_id?: string | null;
  agente_id?: string | null;
  agente_nombre?: string | null;
  naviera_id?: string | null;
  naviera_nombre?: string | null;
  /** N-06 (QA r2): sello leído al abrir el wizard, para el bloqueo optimista. */
  updated_at?: string | null;
}

export interface CotizacionInitialCosto {
  /** Stable identity shared with the derived sale, independent of cost row replacement. */
  origen_venta_id?: string | null;
  /** Exact automatic source needed to preserve sale lineage when recalculating. */
  costeo_tarifa_id?: string | null;
  costeo_tarifa_recargo_id?: string | null;
  concepto: string;
  moneda: string;
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta?: number;
  unidad_medida?: string;
  /** Nota capturada en el paso 2; se rehidrata al editar (P2 13.823.159). */
  notas?: string | null;
}
