/**
 * Construye una fila de costo interno (P&L) a partir del bloque "Flete LCL
 * manual" capturado en el paso 1 del wizard (`lclFleteManual`).
 *
 * Es el equivalente LCL de `buildCostosDesdeTarifa`: evita que el ejecutivo
 * tenga que re-teclear en el paso 2 el flete que ya capturó en el paso 1.
 *
 * Sin I/O ni dependencias de UI. 100% testeable.
 */
import type { FilaCostoLocal, LclFleteManual } from "@/features/cotizacion/types";
import type { DimensionLCL } from "@/features/cotizacion/types/core";
import {
  calcularFleteVentaLCL,
  calcularTotalesLcl,
} from "@/features/cotizacion/utils/calcularWMLcl";

export interface BuildCostosLCLManualArgs {
  lclFleteManual: LclFleteManual | undefined | null;
  dimensiones: DimensionLCL[] | undefined;
  pesoKg: number | undefined;
  /** Nombre del consolidador (si se conoce). Fallback: cadena vacía. */
  consolidadorNombre?: string | null;
}

/**
 * Devuelve una fila USD con el flete LCL, o `[]` si no hay datos suficientes.
 * - `cantidad` = W/M facturable.
 * - `costo_unitario` = tarifa W/M del paso 1.
 * - `precio_venta` = venta total (respetando mínimo) / W/M, para que
 *    `cantidad × precio_venta` reproduzca la venta ya mostrada en paso 1.
 */
export function buildCostosLCLManual({
  lclFleteManual,
  dimensiones,
  pesoKg,
  consolidadorNombre,
}: BuildCostosLCLManualArgs): FilaCostoLocal[] {
  const manual = lclFleteManual;
  if (!manual) return [];

  const tarifaWM = Number(manual.tarifaWM ?? 0);
  const minimo = Number(manual.minimo ?? 0);
  if (!(tarifaWM > 0) && !(minimo > 0)) return [];

  const { wmFacturable } = calcularTotalesLcl(dimensiones, pesoKg);
  if (!(wmFacturable > 0)) return [];

  const ventaTotal = calcularFleteVentaLCL(wmFacturable, tarifaWM, minimo);
  // Precio de venta unitario para que cantidad × precio_venta = ventaTotal.
  const precioVentaUnit = Math.round((ventaTotal / wmFacturable) * 100) / 100;
  const aplicaMinimo = tarifaWM * wmFacturable < minimo;

  const nota = aplicaMinimo
    ? `Auto-cargado desde Flete LCL manual (aplica mínimo USD ${minimo.toFixed(2)})`
    : "Auto-cargado desde Flete LCL manual";

  return [
    {
      concepto: "Flete marítimo LCL",
      moneda: "USD",
      proveedor: consolidadorNombre ?? "",
      cantidad: wmFacturable,
      costo_unitario: tarifaWM,
      precio_venta: precioVentaUnit,
      unidad_medida: "W/M",
      aplica_iva: false,
      notas: nota,
    },
  ];
}
