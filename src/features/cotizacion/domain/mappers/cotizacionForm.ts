/**
 * Mappers puros entre el formulario de cotización (RHF) y la BD.
 * Tipos del formulario viven en `@/data/cotizacionFormTypes` (capa neutra).
 */
import type { DimensionLCL, DimensionAerea } from "@/features/cotizacion/types";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import {
  type CotizacionFormValues,
  type CotizacionInitialData,
  type CotizacionInitialCosto,
  COTIZACION_FORM_DEFAULTS,
} from "@/features/cotizacion/types";

export type { CotizacionFormValues, CotizacionInitialData, CotizacionInitialCosto };
export { COTIZACION_FORM_DEFAULTS };

const DEFAULT_DIM_LCL: DimensionLCL = {
  piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0,
};
const DEFAULT_DIM_AEREA: DimensionAerea = {
  piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 0,
};

// Helpers de sección — extraen las cadenas de `?? ""` fuera del mapper principal.

function partesCliente(d: CotizacionInitialData) {
  return {
    esProspecto: d.es_prospecto,
    clienteId: d.cliente_id ?? "",
    // P0: al editar se restaura el vínculo CRM real (antes se perdía y la
    // cotización quedaba huérfana al volver a guardar).
    prospectoModo: "vincular" as const,
    oportunidadId: d.oportunidad_id ?? "",
    leadId: "",
    // A1/A7: se conserva la moneda ya persistida como moneda del vínculo, para
    // que reeditar un borrador no la cambie a USD sin que el usuario lo pida.
    monedaCrm: (d.moneda === "MXN" ? "MXN" : d.moneda === "USD" ? "USD" : "") as
      | "USD"
      | "MXN"
      | "",
    prospectoEmpresa: d.prospecto_empresa ?? "",
    prospectoContacto: d.prospecto_contacto ?? "",
    prospectoEmail: d.prospecto_email ?? "",
    prospectoTelefono: d.prospecto_telefono ?? "",
    prospectoRfc: "",
    prospectoDireccion: "",
    prospectoCiudad: "",
    prospectoEntidadFederativa: "",
    prospectoCp: "",
  };
}

function partesMercanciaBase(d: CotizacionInitialData) {
  return {
    modo: d.modo,
    tipo: d.tipo,
    incoterm: d.incoterm,
    tipoCarga: d.tipo_carga ?? "Carga General",
    sectorEconomico: d.sector_economico ?? "",
    descripcionMercancia: d.descripcion_mercancia ?? "",
    descripcionAdicional: d.descripcion_adicional ?? "",
    tipoEmbarque: (d.tipo_embarque as "FCL" | "LCL") ?? "FCL",
    tipoContenedor: d.tipo_contenedor ?? "",
    tipoPeso: d.tipo_peso ?? "Peso Normal",
  };
}

function partesMercanciaMedidas(d: CotizacionInitialData) {
  const dimsLcl = (d.dimensiones_lcl as DimensionLCL[]) ?? [];
  const dimsAer = (d.dimensiones_aereas as DimensionAerea[]) ?? [];
  return {
    dimensionesLCL: dimsLcl.length ? dimsLcl : [DEFAULT_DIM_LCL],
    dimensionesAereas: dimsAer.length ? dimsAer : [DEFAULT_DIM_AEREA],
    pesoKg: d.peso_kg ?? 0,
    volumenM3: d.volumen_m3 ?? 0,
    piezas: d.piezas ?? 0,
    tipoUnidad: d.tipo_unidad ?? "",
  };
}

function partesMercancia(d: CotizacionInitialData) {
  return { ...partesMercanciaBase(d), ...partesMercanciaMedidas(d) };
}

function partesRuta(d: CotizacionInitialData) {
  return {
    origen: d.origen ?? "",
    destino: d.destino ?? "",
    tiempoTransitoDias: d.tiempo_transito_dias ?? undefined,
    frecuencia: d.frecuencia ?? "",
    rutaTexto: d.ruta_texto ?? "",
    // EC-06: `validez_propuesta` es date-only; "T00:00:00" lo ancla a
    // medianoche LOCAL (sin sufijo sería medianoche UTC = día anterior CDMX).
    validezPropuesta: d.validez_propuesta ? new Date(`${d.validez_propuesta}T00:00:00`) : undefined,
    tipoMovimiento: d.tipo_movimiento ?? "",
  };
}

function partesLclFleteManual(d: CotizacionInitialData) {
  return {
    tarifaWM: Number(d.lcl_tarifa_wm ?? 0) || 0,
    minimo: Number(d.lcl_minimo_flete ?? 0) || 0,
    diasLibresAlmacenaje: Number(d.lcl_dias_libres_almacenaje ?? 0) || 0,
    consolidadorId: d.lcl_consolidador_id ?? null,
  };
}

function partesSeguro(d: CotizacionInitialData) {
  return {
    seguro: d.seguro ?? false,
    valorSeguroUsd: d.valor_seguro_usd ?? 0,
  };
}

function partesTarifa(d: CotizacionInitialData) {
  return {
    tarifaId: d.tarifa_id ?? null,
    tarifaOverride: (d.tarifa_override ?? {}) as Record<string, boolean>,
    sinDesgloseCostos: d.sin_desglose_costos ?? false,
  };
}

function partesAgenteNaviera(d: CotizacionInitialData) {
  return {
    agenteId: d.agente_id ?? null,
    agenteNombre: d.agente_nombre ?? "",
    navieraId: d.naviera_id ?? null,
    navieraNombre: d.naviera_nombre ?? "",
  };
}

function partesExtras(d: CotizacionInitialData) {
  return {
    ...partesSeguro(d),
    diasLibresDestino: d.dias_libres_destino ?? 0,
    diasAlmacenaje: d.dias_almacenaje ?? 0,
    cartaGarantia: d.carta_garantia ?? false,
    notas: d.notas ?? "",
    numContenedores: d.num_contenedores ?? 1,
    modalidadEquipo: d.modalidad_equipo ?? "",
    puntoIntermedio: d.punto_intermedio ?? "",
    ...partesTarifa(d),
    lclFleteManual: partesLclFleteManual(d),
    ...partesAgenteNaviera(d),
  };
}

export function buildCotizacionDefaultValues(d?: CotizacionInitialData): CotizacionFormValues {
  if (!d) return COTIZACION_FORM_DEFAULTS;
  return {
    ...partesCliente(d),
    ...partesMercancia(d),
    ...partesRuta(d),
    ...partesExtras(d),
  };
}

export function buildCotizacionInitialCostos(initialCostos?: CotizacionInitialCosto[]): FilaCostoLocal[] {
  return (initialCostos ?? []).map((c) => ({
    concepto: c.concepto,
    moneda: c.moneda as "USD" | "MXN",
    proveedor: c.proveedor,
    cantidad: c.cantidad,
    costo_unitario: c.costo_unitario,
    precio_venta: c.precio_venta ?? 0,
    unidad_medida: c.unidad_medida ?? "Contenedor",
    // P2 (13.823.159): la nota guardada se restaura al editar. Antes se omitía
    // y `savePaso2` la reescribía como "" en el siguiente guardado.
    notas: c.notas ?? "",
  }));
}

