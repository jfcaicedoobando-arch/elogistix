/**
 * Partes puras del payload de datos generales (Paso 1) de una cotización.
 * Extraído de `cotizacion.ts` (Power-of-10 #4: archivos ≤200 líneas). Sin
 * cambios de comportamiento.
 */
import { format } from "date-fns";
import type { DimensionLCL, DimensionAerea } from "@/features/cotizacion/types";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

/**
 * Normaliza a `YYYY-MM-DD`. Acepta `Date` o string ISO — el draft autosave
 * pasa por `JSON.stringify`, así que al rehidratar un borrador guardado en
 * localStorage los `Date` llegan como string. Defensivo en el boundary.
 */
export function toIsoDateString(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "yyyy-MM-dd"); // FE-04: día local, no UTC
}

export function partesCliente(
  v: CotizacionFormValues,
  clientes: { id: string; nombre: string }[],
) {
  const cliente = clientes.find((c) => c.id === v.clienteId);
  return {
    es_prospecto: v.esProspecto,
    cliente_id: v.esProspecto ? null : v.clienteId,
    cliente_nombre: v.esProspecto ? v.prospectoEmpresa : (cliente?.nombre ?? ''),
    prospecto_empresa: v.esProspecto ? v.prospectoEmpresa : '',
    prospecto_contacto: v.esProspecto ? v.prospectoContacto : '',
    prospecto_email: v.esProspecto ? v.prospectoEmail : '',
    prospecto_telefono: v.esProspecto ? v.prospectoTelefono : '',
  };
}

function partesMercanciaMaritimo(v: CotizacionFormValues) {
  const esMaritimo = v.modo === "Marítimo";
  const esFcl = esMaritimo && v.tipoEmbarque === "FCL";
  const esLcl = esMaritimo && v.tipoEmbarque === "LCL";
  return {
    tipo_embarque: esMaritimo ? v.tipoEmbarque : "FCL",
    tipo_contenedor: esFcl ? v.tipoContenedor : null,
    tipo_peso: esFcl ? v.tipoPeso : "Peso Normal",
    dimensiones_lcl: (esLcl ? v.dimensionesLCL : []) as DimensionLCL[],
    dias_libres_destino: esFcl ? v.diasLibresDestino : 0,
    dias_almacenaje: esLcl ? v.diasAlmacenaje : 0,
    carta_garantia: esFcl ? v.cartaGarantia : false,
  };
}

export function partesMercancia(v: CotizacionFormValues) {
  const esAereo = v.modo === "Aéreo";
  const esTerrestre = v.modo === "Terrestre";
  return {
    modo: v.modo,
    tipo: v.tipo,
    incoterm: esTerrestre ? "N/A" : v.incoterm,
    tipo_carga: v.tipoCarga,
    msds_archivo: null as string | null,
    ...partesMercanciaMaritimo(v),
    // B-035: campo dedicado; fallback a descripción adicional / sector para
    // no romper cotizaciones legacy que no lo tienen capturado.
    descripcion_mercancia: (v.descripcionMercancia?.trim() || v.descripcionAdicional?.trim() || v.sectorEconomico),
    descripcion_adicional: v.descripcionAdicional,
    sector_economico: v.sectorEconomico,
    dimensiones_aereas: (esAereo ? v.dimensionesAereas : []) as DimensionAerea[],
    // BL-COT-04: fuera del marítimo no hay contenedores; antes se persistía el
    // 1 que inventaba el formulario y llegaba al embarque como hijo vacío.
    num_contenedores: v.modo === "Marítimo" ? v.numContenedores : 0,
    tipo_unidad: esTerrestre ? v.tipoUnidad : null,
  };
}

export function partesRuta(v: CotizacionFormValues) {
  const esTerrestre = v.modo === "Terrestre";
  return {
    origen: v.origen,
    destino: v.destino,
    tiempo_transito_dias: v.tiempoTransitoDias ?? null,
    frecuencia: v.frecuencia,
    ruta_texto: v.rutaTexto,
    validez_propuesta: toIsoDateString(v.validezPropuesta),
    tipo_movimiento: esTerrestre ? "" : v.tipoMovimiento,
    seguro: v.seguro,
    valor_seguro_usd: v.seguro ? Number(v.valorSeguroUsd) || 0 : 0,
    modalidad_equipo: esTerrestre ? (v.modalidadEquipo || null) : null,
    punto_intermedio: esTerrestre ? (v.puntoIntermedio || null) : null,
  };
}

export function partesLclManual(values: CotizacionFormValues) {
  const esLcl = values.modo === "Marítimo" && values.tipoEmbarque === "LCL";
  const lclManual = values.lclFleteManual;
  return {
    lcl_tarifa_wm: esLcl ? (Number(lclManual?.tarifaWM) || null) : null,
    lcl_minimo_flete: esLcl ? (Number(lclManual?.minimo) || null) : null,
    lcl_dias_libres_almacenaje: esLcl
      ? (Number(lclManual?.diasLibresAlmacenaje) || null)
      : null,
    lcl_consolidador_id: esLcl ? (lclManual?.consolidadorId ?? null) : null,
  };
}
