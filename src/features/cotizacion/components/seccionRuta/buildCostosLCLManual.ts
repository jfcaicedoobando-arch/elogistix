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
  /** B-075: markup decimal aplicado a la venta (0.15 = 15%), igual que FCL. */
  markup?: number;
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
  markup,
}: BuildCostosLCLManualArgs): FilaCostoLocal[] {
  const manual = lclFleteManual;
  if (!manual) return [];

  const tarifaWM = Number(manual.tarifaWM ?? 0);
  const minimo = Number(manual.minimo ?? 0);
  if (!(tarifaWM > 0) && !(minimo > 0)) return [];

  const { wmFacturable } = calcularTotalesLcl(dimensiones, pesoKg);
  if (!(wmFacturable > 0)) return [];

  // El flete marítimo LCL se cotiza como UN servicio único (cantidad = 1).
  // El desglose W/M vive en el paso 1 y queda documentado en `notas`.
  const costoTotal = Math.round(wmFacturable * tarifaWM * 100) / 100;
  const ventaTotal = calcularFleteVentaLCL(wmFacturable, tarifaWM, minimo, markup);
  const aplicaMinimo = tarifaWM * wmFacturable < minimo;

  const detalleWm = `W/M facturable ${wmFacturable} @ USD ${tarifaWM.toFixed(2)}`;
  const nota = aplicaMinimo
    ? `Auto-cargado desde Flete LCL manual — ${detalleWm} (aplica mínimo USD ${minimo.toFixed(2)})`
    : `Auto-cargado desde Flete LCL manual — ${detalleWm}`;

  return [
    {
      concepto: "Flete marítimo LCL",
      moneda: "USD",
      proveedor: consolidadorNombre ?? "",
      cantidad: 1,
      costo_unitario: costoTotal,
      precio_venta: ventaTotal,
      unidad_medida: "Servicio",
      aplica_iva: false,
      notas: nota,
    },
  ];
}
