/**
 * Helpers para totalizar listas de conceptos en una moneda objetivo.
 * La conversión se delega al canon único (`@/lib/financial/convertir`) y la
 * acumulación a currency.js, para evitar errores de punto flotante.
 * Sin React, sin formato.
 *
 * `sumarEnMoneda` es la API estricta: detecta filas cuya `moneda` no coincide
 * con el `target` del bucket padre y SIEMPRE las convierte vía FX (nunca suma
 * nativamente valores heterogéneos). Lanza si falta TC con filas mixtas.
 *
 * FIX C6: ya no se usan `convertirAMXN`/`convertirAUSD` (tenían TC=1 por
 * omisión); el factor sale de `factorEntreMonedas` y un TC no confiable
 * produce un error explícito en vez de una suma silenciosa 1:1.
 */

import currency from "currency.js";
import { factorEntreMonedas } from "@/lib/financial/convertir";
import { type Moneda } from "@/lib/financial/financialUtils";

interface MontoEnMoneda {
  monto: number;
  moneda: string;
}

export interface FilaMixta {
  index: number;
  moneda: string;
}

export interface SumaMonedaResult {
  /** Total acumulado expresado en `target`, con precisión 2. */
  total: number;
  /** Filas cuya moneda ≠ target (se les aplicó FX). */
  filasMixtas: FilaMixta[];
  /** true si todas las filas eran de la moneda target. */
  homogenea: boolean;
}

const MONEDAS_VALIDAS: ReadonlyArray<Moneda> = ['USD', 'MXN', 'EUR'];

function esMoneda(m: string): m is Moneda {
  return (MONEDAS_VALIDAS as readonly string[]).includes(m);
}

/**
 * Devuelve los índices de filas cuya moneda no coincide con `target`.
 * Útil para marcar visualmente celdas en la UI sin recalcular totales.
 */
export function detectarFilasMixtas(
  items: ReadonlyArray<{ moneda: string }>,
  target: Moneda,
): FilaMixta[] {
  const out: FilaMixta[] = [];
  for (let i = 0; i < items.length; i++) {
    const m = items[i].moneda;
    if (m !== target) out.push({ index: i, moneda: m });
  }
  return out;
}

/**
 * Suma estricta a una moneda objetivo. Convierte vía TC las filas cuya
 * `moneda` difiera del `target` y reporta cuáles fueron mixtas. La conversión
 * nunca se omite: si hay filas mixtas y `tcUSD <= 0` (o `tcEUR <= 0` cuando
 * aparece EUR) lanza `Error` en lugar de colapsar silenciosamente a TC=1.
 */
export function sumarEnMoneda(
  items: ReadonlyArray<MontoEnMoneda>,
  target: Moneda,
  tcUSD: number,
  tcEUR: number,
): SumaMonedaResult {
  const filasMixtas = detectarFilasMixtas(items, target);
  const homogenea = filasMixtas.length === 0;

  if (!homogenea) {
    const necesitaUSD = filasMixtas.some(f => f.moneda === 'USD' || f.moneda === 'MXN' || f.moneda === 'EUR');
    const necesitaEUR = filasMixtas.some(f => f.moneda === 'EUR');
    if (necesitaUSD && (!Number.isFinite(tcUSD) || tcUSD <= 0)) {
      throw new Error('TC requerido para conversión: tipoCambioUSD inválido con filas en moneda distinta al target');
    }
    if (necesitaEUR && (!Number.isFinite(tcEUR) || tcEUR <= 0)) {
      throw new Error('TC requerido para conversión: tipoCambioEUR inválido con filas EUR');
    }
  }

  const total = items
    .reduce((acc, item) => {
      const moneda = esMoneda(item.moneda) ? item.moneda : target;
      return acc.add(convertirFila(item.monto, moneda, target, tcUSD, tcEUR));
    }, currency(0, { precision: 2 }))
    .value;

  return { total, filasMixtas, homogenea };
}

/**
 * Suma una lista de montos convirtiéndolos a USD.
 * Wrapper de `sumarEnMoneda(..., 'USD', ...).total` para compatibilidad.
 */
export function sumarEnUSD(
  items: MontoEnMoneda[],
  tcUSD: number,
  tcEUR: number,
): number {
  // FIX-11 (Fase 4): eliminado el fallback silencioso TC=1. Cuando falta el
  // TC de USD, sólo sumamos filas que YA vienen en USD; el resto se ignora
  // y la UI muestra el banner `tcMissing` para forzar la captura.
  return sumarEnMoneda(items, 'USD', tcUSD, tcEUR).total;
}

/**
 * Convierte un monto único a USD (wrapper conveniente).
 *
 * Si `moneda` ≠ 'USD' valida que `tcUSD` (y `tcEUR` para EUR) sean finitos y > 0.
 * Antes devolvía silenciosamente `Infinity`/`NaN` cuando el TC venía en 0, lo
 * cual se propagaba a totales financieros. Ahora lanza explícitamente — la UI
 * debe esperar a tener TC vigente antes de llamar este helper.
 */
export function aUSD(monto: number, moneda: string, tcUSD: number, tcEUR: number): number {
  if (moneda === 'USD') return monto;
  if (!Number.isFinite(tcUSD) || tcUSD <= 0) {
    throw new Error('TC requerido para conversión: tipoCambioUSD inválido (0/NaN) al convertir a USD');
  }
  if (moneda === 'EUR' && (!Number.isFinite(tcEUR) || tcEUR <= 0)) {
    throw new Error('TC requerido para conversión: tipoCambioEUR inválido (0/NaN) al convertir EUR a USD');
  }
  return convertirAUSD(monto, moneda as Moneda, tcUSD, tcEUR);
}

