/**
 * Builders puros del payload de inserción para `cotizaciones`.
 * Sin I/O. Aislados para mantener cada operación de mutación pequeña.
 */
import type { TablesInsert } from "@/integrations/supabase/types";
import type { CreateCotizacionInput } from "@/features/cotizacion/types";
import { toDbJson } from "@/lib/supabase/cast";

type CotizacionInsert = TablesInsert<"cotizaciones">;

function partesClienteInsert(input: CreateCotizacionInput) {
  return {
    cliente_id: input.es_prospecto ? null : input.cliente_id,
    cliente_nombre: input.cliente_nombre,
    es_prospecto: input.es_prospecto,
    prospecto_empresa: input.prospecto_empresa || "",
    prospecto_contacto: input.prospecto_contacto || "",
    prospecto_email: input.prospecto_email || "",
    prospecto_telefono: input.prospecto_telefono || "",
  };
}

function partesMercanciaInsert(input: CreateCotizacionInput) {
  return {
    modo: input.modo as CotizacionInsert["modo"],
    tipo: input.tipo as CotizacionInsert["tipo"],
    incoterm: input.incoterm as CotizacionInsert["incoterm"],
    descripcion_mercancia: input.descripcion_mercancia,
    peso_kg: input.peso_kg,
    volumen_m3: input.volumen_m3,
    piezas: input.piezas,
    origen: input.origen,
    destino: input.destino,
    tipo_carga: input.tipo_carga || "Carga General",
    msds_archivo: input.msds_archivo || null,
    tipo_embarque: input.tipo_embarque || "FCL",
    tipo_contenedor: input.tipo_contenedor || null,
    tipo_peso: input.tipo_peso || "Peso Normal",
    descripcion_adicional: input.descripcion_adicional || "",
    sector_economico: input.sector_economico || "",
    dimensiones_lcl: toDbJson(input.dimensiones_lcl || []),
    dimensiones_aereas: toDbJson(input.dimensiones_aereas || []),
    num_contenedores: input.num_contenedores ?? 1,
    modalidad_equipo: input.modalidad_equipo ?? null,
    punto_intermedio: input.punto_intermedio ?? null,
  };
}

function partesComercialBase(input: CreateCotizacionInput) {
  return {
    conceptos_venta: toDbJson(input.conceptos_venta),
    subtotal: input.subtotal,
    moneda: input.moneda as CotizacionInsert["moneda"],
    vigencia_dias: input.vigencia_dias,
    notas: input.notas || null,
    operador: input.operador,
    dias_libres_destino: input.dias_libres_destino ?? 0,
    dias_almacenaje: input.dias_almacenaje ?? 0,
    tiempo_transito_dias: input.tiempo_transito_dias ?? null,
    frecuencia: input.frecuencia || "",
    ruta_texto: input.ruta_texto || "",
    validez_propuesta: input.validez_propuesta ?? null,
    tipo_movimiento: input.tipo_movimiento || "",
  };
}

function partesSeguroInsert(input: CreateCotizacionInput) {
  return {
    seguro: input.seguro ?? false,
    valor_seguro_usd: input.valor_seguro_usd ?? 0,
    carta_garantia: input.carta_garantia ?? false,
  };
}

function partesTarifaInsert(input: CreateCotizacionInput) {
  return {
    tarifa_id: input.tarifa_id ?? null,
    tarifa_override: toDbJson(input.tarifa_override ?? {}),
  };
}

function partesAgenteNavieraInsert(input: CreateCotizacionInput) {
  // NOTA: `cotizaciones` sólo tiene `agente_id` y `naviera_id`. Los nombres
  // se resuelven vía JOIN en las vistas (PGRST204 si se envían). v13.303.62.
  return {
    agente_id: input.agente_id ?? null,
    naviera_id: input.naviera_id ?? null,
  };
}

function partesComercialInsert(input: CreateCotizacionInput) {
  return {
    ...partesComercialBase(input),
    ...partesSeguroInsert(input),
    ...partesTarifaInsert(input),
    ...partesAgenteNavieraInsert(input),
  };
}

/**
 * B-092: parámetros del flete LCL manual (W/M). El mapper del wizard
 * (`partesLclManual`) y el UPDATE ya los manejan; el INSERT los descartaba
 * por lista blanca y las columnas quedaban NULL (auditoría W/M degradada).
 */
function partesLclInsert(input: CreateCotizacionInput) {
  return {
    lcl_tarifa_wm: input.lcl_tarifa_wm ?? null,
    lcl_minimo_flete: input.lcl_minimo_flete ?? null,
    lcl_dias_libres_almacenaje: input.lcl_dias_libres_almacenaje ?? null,
    lcl_consolidador_id: input.lcl_consolidador_id ?? null,
  };
}

export function buildCotizacionInsertPayload(
  input: CreateCotizacionInput,
  folio: string,
  fechaVigenciaIso: string,
): CotizacionInsert {
  return {
    folio,
    fecha_vigencia: fechaVigenciaIso,
    ...partesClienteInsert(input),
    ...partesMercanciaInsert(input),
    ...partesComercialInsert(input),
    ...partesLclInsert(input),
  };
}

export type { CotizacionInsert };
