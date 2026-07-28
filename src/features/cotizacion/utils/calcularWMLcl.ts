/**
 * Cálculos de W/M (Weight or Measure) para embarques LCL.
 *
 * W/M es la unidad estándar de facturación en LCL: el mayor entre el peso
 * total (en toneladas, i.e. kg / 1000) y el volumen total (m³). Como
 * las tarifas se cotizan por m³ o por tonelada, la convención práctica
 * usada aquí es `chargeable = max(peso_kg / 1000, volumen_m3)` — es
 * decir, comparamos ambos en la misma unidad (t vs m³) y nos quedamos
 * con el mayor.
 *
 * Sin dependencias de UI. 100% testeable.
 */
import type { DimensionLCL } from "@/features/cotizacion/types/core";

export interface TotalesLcl {
  /** Suma de piezas de todas las filas. */
  totalPiezas: number;
  /** Suma de m³ (usa `volumen_m3` ya calculado por fila). */
  totalVolumenM3: number;
  /** Peso total en kilogramos (proviene del campo plano `pesoKg` del formulario). */
  totalPesoKg: number;
  /** W/M facturable: max(peso_kg/1000, volumen_m3), redondeado a 4 decimales. */
  wmFacturable: number;
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * Calcula los totales LCL. Devuelve ceros cuando no hay filas o peso.
 * Nunca lanza; blindado contra `undefined` / NaN.
 */
export function calcularTotalesLcl(
  dimensiones: DimensionLCL[] | undefined,
  pesoKg: number | undefined,
): TotalesLcl {
  const rows = dimensiones ?? [];
  const totalPiezas = rows.reduce((s, d) => s + safeNum(d?.piezas), 0);
  const totalVolumenM3 = round4(rows.reduce((s, d) => s + safeNum(d?.volumen_m3), 0));
  const totalPesoKg = safeNum(pesoKg);
  const pesoEnTon = totalPesoKg / 1000;
  const wmFacturable = round4(Math.max(pesoEnTon, totalVolumenM3));
  return { totalPiezas, totalVolumenM3, totalPesoKg, wmFacturable };
}

function safeNum(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Calcula la venta de flete LCL a partir de tarifa W/M y mínimo.
 * Aplica: `venta = max(wm × tarifaWM, minimo) × (1 + markup)`.
 * B-075: el markup configurable (`cotizaciones.markup_default_maritimo`,
 * default 15%) se aplica igual que en FCL — antes la venta LCL salía a
 * precio de costo (margen 0%) salvo edición manual en el paso 2.
 * Redondea a 2 decimales (USD). Devuelve 0 si ambos parámetros son inválidos.
 */
export function calcularFleteVentaLCL(
  wmFacturable: number,
  tarifaWM: number | null | undefined,
  minimo: number | null | undefined,
  markup: number | null | undefined = 0,
): number {
  const wm = safeNum(wmFacturable);
  const tarifa = safeNum(tarifaWM);
  const min = safeNum(minimo);
  const mk = Number(markup);
  const factor = 1 + (Number.isFinite(mk) && mk >= 0 ? mk : 0);
  const calc = wm * tarifa;
  const bruto = Math.max(calc, min);
  return Math.round(bruto * factor * 100) / 100;
}
