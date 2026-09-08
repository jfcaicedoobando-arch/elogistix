import { hoyMx, parseLocalMx } from "@/lib/date/mx";
import { diffDiasCalendario } from "@/lib/date/dateOnly";
import type { ConceptoVentaCotizacion } from '@/features/cotizacion/types';
import type { CotizacionFormValues } from '@/features/cotizacion/types';
import {
  partesCliente,
  partesMercancia,
  partesRuta,
  partesLclManual,
} from "./cotizacionPartes";

/**
 * Construye el payload de datos generales (Paso 1) para crear/actualizar una cotización.
 * Función pura sin dependencias de React.
 */

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

/**
 * A1/A7 (v13.823.151): la moneda del encabezado se derivaba siempre a 'USD' en
 * el paso 1, incluso al editar. Si la oportunidad CRM vinculada estaba en MXN,
 * el vínculo fallaba con "monedas distintas" y la pantalla mostraba MXN mientras
 * la cotización persistía USD. Ahora:
 *   - borrador sin importes → se adopta la moneda de la oportunidad;
 *   - con importes capturados → NO se toca la moneda (no se reinterpreta dinero)
 *     y el bloqueo/mensaje de la RPC guía la recuperación.
 */
export interface MonedaPaso1Opts {
  /** true cuando la cotización aún no existe (no hay moneda persistida). */
  esNuevo?: boolean;
  /** Moneda dominante de los importes ya capturados, si es una sola. */
  monedaImportes?: "USD" | "MXN";
}

export function monedaPaso1(
  values: CotizacionFormValues,
  sinImportes: boolean,
  opts: MonedaPaso1Opts = {},
): "USD" | "MXN" | undefined {
  const respaldo = values.monedaCrm || "USD";
  if (sinImportes) return respaldo;
  // VF (13.823.198): al CREAR no hay nada que proteger y el schema exige
  // `moneda`; se usa la moneda de los importes capturados y, si están mezclados
  // (o no hay una sola), el respaldo del vínculo CRM.
  if (opts.esNuevo) return opts.monedaImportes ?? respaldo;
  return undefined;
}

export function buildPaso1Data(
  values: CotizacionFormValues,
  clientes: { id: string; nombre: string }[],
  userEmail: string,
  sinImportes = true,
  monedaOpts: MonedaPaso1Opts = {},
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
    moneda: monedaPaso1(values, sinImportes, monedaOpts),
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
