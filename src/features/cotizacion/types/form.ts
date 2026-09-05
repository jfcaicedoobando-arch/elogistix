/**
 * Tipos del formulario de Cotización (capa neutra, sin dependencias UI).
 * Movido desde src/lib/cotizacionFormMappers.ts para romper la inversión de
 * dependencia (lib no debe importar tipos desde components).
 */
import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from "./core";

export type ProspectoVinculacionModo = "vincular" | "nuevo";

/**
 * Captura manual de flete LCL cuando el ejecutivo no vincula una tarifa.
 * Se persiste en columnas `lcl_*` de `cotizaciones`.
 */
export interface LclFleteManual {
  /** Tarifa USD por W/M (peso o volumen, el mayor). */
  tarifaWM: number;
  /** Mínimo de flete en USD (piso). */
  minimo: number;
  /** Días libres de almacenaje en destino (LCL). */
  diasLibresAlmacenaje: number;
  /** Consolidador / agente LCL (proveedor). */
  consolidadorId: string | null;
}

export interface CotizacionFormValues {
  esProspecto: boolean;
  clienteId: string;
  prospectoModo: ProspectoVinculacionModo;
  oportunidadId: string;
  leadId: string;
  /**
   * A1/A7 (v13.823.151): moneda registrada en la oportunidad CRM vinculada.
   * La RPC de vínculo exige que coincida con la de la cotización; se guarda al
   * seleccionar el vínculo para que un borrador sin importes nazca/quede en esa
   * misma moneda.
   */
  monedaCrm: "USD" | "MXN" | "";
  prospectoEmpresa: string;
  prospectoContacto: string;
  prospectoEmail: string;
  prospectoTelefono: string;
  /** Datos fiscales opcionales del prospecto (se guardan en el lead del CRM). */
  prospectoRfc: string;
  prospectoDireccion: string;
  prospectoCiudad: string;
  prospectoEntidadFederativa: string;
  prospectoCp: string;
  modo: string;
  tipo: string;
  incoterm: string;
  tipoCarga: string;
  sectorEconomico: string;
  /** B-035: descripción real de la mercancía (columna `descripcion_mercancia`). */
  descripcionMercancia: string;
  descripcionAdicional: string;
  tipoEmbarque: "FCL" | "LCL" | "";
  tipoContenedor: string;
  tipoPeso: string;
  dimensionesLCL: DimensionLCL[];
  dimensionesAereas: DimensionAerea[];
  pesoKg: number;
  volumenM3: number;
  piezas: number;
  tipoUnidad: string;
  origen: string;
  destino: string;
  tiempoTransitoDias: number | undefined;
  frecuencia: string;
  rutaTexto: string;
  validezPropuesta: Date | undefined;
  tipoMovimiento: string;
  seguro: boolean;
  valorSeguroUsd: number;
  diasLibresDestino: number;
  diasAlmacenaje: number;
  cartaGarantia: boolean;
  notas: string;
  numContenedores: number;
  /** Modalidad de equipo terrestre (Caja Seca, Porta Contenedor, ...). */
  modalidadEquipo: string;
  /** Punto intermedio de carga/descarga (terrestre Porta Contenedor). */
  puntoIntermedio: string;
  /** Tarifa marítima del módulo Costeo vinculada (fuente de verdad). */
  tarifaId: string | null;
  /** Campos editados manualmente tras elegir tarifa (para auditoría). */
  tarifaOverride: Record<string, boolean>;
  /** Atajo: cotización creada sin desglose interno de costos (Paso 2 omitido). */
  sinDesgloseCostos: boolean;
  /** Flete LCL capturado manualmente (usado sólo cuando no hay tarifa vinculada). */
  lclFleteManual: LclFleteManual;
  /** Agente heredado de la tarifa (FK a costeo_agentes). */
  agenteId: string | null;
  agenteNombre: string;
  /** Naviera heredada de la tarifa (FK a navieras). */
  navieraId: string | null;
  navieraNombre: string;
}

export { COTIZACION_FORM_DEFAULTS,  } from "./formDefaults";


export interface CotizacionInitialData {
  id: string;
  estado: string;
  folio: string;
  es_prospecto: boolean;
  cliente_id: string | null;
  /** P0: vínculo CRM real; se restaura al editar para no dejarla huérfana. */
  oportunidad_id?: string | null;
  /** A1/A7: moneda persistida; se conserva como moneda del vínculo al editar. */
  moneda?: string | null;
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
  volumen_m3: number;
  piezas: number;
  tipo_unidad: string | null;
  origen: string;
  destino: string;
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
  concepto: string;
  moneda: string;
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta?: number;
  unidad_medida?: string;
}
