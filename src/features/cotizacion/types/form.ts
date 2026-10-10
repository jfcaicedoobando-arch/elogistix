/**
 * Tipos del formulario de Cotización (capa neutra, sin dependencias UI).
 * Movido desde src/lib/cotizacionFormMappers.ts para romper la inversión de
 * dependencia (lib no debe importar tipos desde components).
 */
import type { DimensionLCL, DimensionAerea } from "./core";

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
  /** Identidad explícita de la respuesta; nunca inferida de oportunidad/tarifa. */
  pricingSolicitudId?: string | null;
  pricingOrigen?: { solicitudId: string; organizationId: string; clienteId: string; oportunidadId: string; tarifaId: string } | null;
  /** Guardado terminado, vínculo aún por confirmar; sobrevive a la recarga. */
  pricingVinculoPendienteId?: string | null;
  pricingVinculoPendienteFirma?: string | null;
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
  /**
   * Etapa 3 — identidad EXACTA del puerto elegido del catálogo (UUID). El texto
   * `origen`/`destino` sigue siendo lo que ve el cliente (puede ser una ruta
   * puerta a puerta); estos IDs son la fuente de verdad para buscar tarifa y
   * heredar la ruta al embarque. `null` cuando se capturó texto libre.
   */
  puertoOrigenId: string | null;
  puertoDestinoId: string | null;

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
export type { CotizacionInitialData, CotizacionInitialCosto } from "./formInitial";
