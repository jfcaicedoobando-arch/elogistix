import { format } from "date-fns";
import { hoyMx, parseLocalMx } from "@/lib/date/mx";
import { diffDiasCalendario } from "@/lib/date/dateOnly";
import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from '@/features/cotizacion/types';
import type { CotizacionFormValues } from '@/features/cotizacion/types';


/**
 * Construye el payload de datos generales (Paso 1) para crear/actualizar una cotización.
 * Función pura sin dependencias de React.
 */

/**
 * Normaliza a `YYYY-MM-DD`. Acepta `Date` o string ISO — el draft autosave
 * pasa por `JSON.stringify`, así que al rehidratar un borrador guardado en
 * localStorage los `Date` llegan como string. Defensivo en el boundary.
 */
function toIsoDateString(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "yyyy-MM-dd"); // FE-04: día local, no UTC
}

interface PesoVolumen { peso: number; volumen: number; piezas: number }

function calcularPesoVolumenPiezas(v: CotizacionFormValues): PesoVolumen {
  if (v.modo === "Marítimo") {
    if (v.tipoEmbarque === "LCL") {
      return {
        // v13.299.0: LCL persiste peso total capturado (antes se guardaba 0),
        // necesario para calcular W/M al reabrir la cotización.
        peso: Number(v.pesoKg) || 0,
        volumen: v.dimensionesLCL.reduce((s, d) => s + d.volumen_m3, 0),
        piezas: v.dimensionesLCL.reduce((s, d) => s + d.piezas, 0),
      };
    }
    return { peso: 0, volumen: 0, piezas: 0 };
  }
  if (v.modo === "Aéreo") {
    return {
      peso: v.dimensionesAereas.reduce((s, d) => s + d.peso_volumetrico_kg, 0),
      volumen: 0,
      piezas: v.dimensionesAereas.reduce((s, d) => s + d.piezas, 0),
    };
  }
  return { peso: v.pesoKg, volumen: v.volumenM3, piezas: v.piezas };
}

function coerceDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Ola 18: días de vigencia = diferencia contra el día local MX, no contra
 * `Date.now()` (que cambiaba el resultado según la hora de captura). Sólo es
 * informativo: la fuente de verdad de la vigencia es `validez_propuesta` y el
 * trigger `_cotizaciones_sync_vigencia` la sincroniza en BD.
 */
function vigenciaDias(validez?: Date): number {
  const d = coerceDate(validez);
  if (!d) return 15;
  return Math.max(1, diffDiasCalendario(parseLocalMx(hoyMx()), d));
}


function partesCliente(v: CotizacionFormValues, clientes: { id: string; nombre: string }[]) {
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

function partesMercancia(v: CotizacionFormValues) {
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
    num_contenedores: v.numContenedores,
    tipo_unidad: esTerrestre ? v.tipoUnidad : null,
  };
}

function partesRuta(v: CotizacionFormValues) {
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

function partesLclManual(values: CotizacionFormValues) {
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

/**
 * A1/A7 (v13.823.151): la moneda del encabezado se derivaba siempre a 'USD' en
 * el paso 1, incluso al editar. Si la oportunidad CRM vinculada estaba en MXN,
 * el vínculo fallaba con "monedas distintas" y la pantalla mostraba MXN mientras
 * la cotización persistía USD. Ahora:
 *   - borrador sin importes → se adopta la moneda de la oportunidad;
 *   - con importes capturados → NO se toca la moneda (no se reinterpreta dinero)
 *     y el bloqueo/mensaje de la RPC guía la recuperación.
 */
export function monedaPaso1(
  values: CotizacionFormValues,
  sinImportes: boolean,
): "USD" | "MXN" | undefined {
  if (!sinImportes) return undefined;
  return values.monedaCrm || "USD";
}

export function buildPaso1Data(
  values: CotizacionFormValues,
  clientes: { id: string; nombre: string }[],
  userEmail: string,
  sinImportes = true,
): Record<string, unknown> {
  const { peso, volumen, piezas } = calcularPesoVolumenPiezas(values);
  return {
    ...partesCliente(values, clientes),
    ...partesMercancia(values),
    ...partesRuta(values),
    peso_kg: peso,
    volumen_m3: volumen,
    piezas,
    conceptos_venta: [] as ConceptoVentaCotizacion[],
    subtotal: 0,
    moneda: monedaPaso1(values, sinImportes),
    vigencia_dias: vigenciaDias(values.validezPropuesta),
    notas: values.notas,
    operador: userEmail,
    tarifa_id: values.tarifaId ?? null,
    tarifa_override: values.tarifaOverride ?? {},
    sin_desglose_costos: values.sinDesgloseCostos ?? false,
    agente_id: values.agenteId ?? null,
    naviera_id: values.navieraId ?? null,
    // 13.308.6: `agente_nombre` y `naviera_nombre` NO existen en `cotizaciones` (viven en vistas
    // derivadas vía JOIN). Enviarlos rompía PGRST204. Sentry JAVASCRIPT-REACT-33/32/1V.
    ...partesLclManual(values),
  };
}
