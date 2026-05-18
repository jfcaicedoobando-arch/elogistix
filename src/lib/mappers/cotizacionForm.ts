/**
 * Mappers puros entre el formulario de cotización (RHF) y la BD.
 * Tipos del formulario viven en `@/data/cotizacionFormTypes` (capa neutra).
 */
import type { DimensionLCL, DimensionAerea } from "@/types/cotizacion";
import type { FilaCostoLocal } from "@/types/cotizacionPL";
import {
  type CotizacionFormValues,
  type CotizacionInitialData,
  type CotizacionInitialCosto,
  COTIZACION_FORM_DEFAULTS,
} from "@/types/cotizacionForm";

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
    prospectoEmpresa: d.prospecto_empresa ?? "",
    prospectoContacto: d.prospecto_contacto ?? "",
    prospectoEmail: d.prospecto_email ?? "",
    prospectoTelefono: d.prospecto_telefono ?? "",
  };
}

function partesMercanciaBase(d: CotizacionInitialData) {
  return {
    modo: d.modo,
    tipo: d.tipo,
    incoterm: d.incoterm,
    tipoCarga: d.tipo_carga ?? "Carga General",
    sectorEconomico: d.sector_economico ?? "",
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
    validezPropuesta: d.validez_propuesta ? new Date(d.validez_propuesta) : undefined,
    tipoMovimiento: d.tipo_movimiento ?? "",
  };
}

function partesExtras(d: CotizacionInitialData) {
  return {
    seguro: d.seguro ?? false,
    valorSeguroUsd: d.valor_seguro_usd ?? 0,
    diasLibresDestino: d.dias_libres_destino ?? 0,
    diasAlmacenaje: d.dias_almacenaje ?? 0,
    cartaGarantia: d.carta_garantia ?? false,
    notas: d.notas ?? "",
    numContenedores: d.num_contenedores ?? 1,
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
  }));
}
