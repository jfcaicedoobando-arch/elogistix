/**
 * Construye filas de costos internos (P&L) a partir de una tarifa marítima
 * vinculada. v13.35.0 — política tarifa-first.
 *
 *  - Genera 1 fila por flete base (concepto "Flete marítimo").
 *  - Genera 1 fila por recargo (BAF, LSS, ISPS, Cargos en Origen/Destino, etc.).
 *  - Aplica un markup configurable a `precio_venta` (default 15%).
 *  - Moneda fija USD (las tarifas se cotizan en USD).
 *
 * No hace I/O. Sólo transforma datos. El llamador decide si remplaza o
 * agrega a `costosInternos`.
 */
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import type { TopTarifaRow, CosteoTarifaRecargo } from "@/features/costeo/types";
import { roundMoney } from "@/lib/financial/financialUtils";

export interface BuildCostosDesdeTarifaArgs {
  tarifa: Pick<
    TopTarifaRow,
    "id" | "flete_base" | "naviera_nombre" | "tipo_contenedor_nombre"
  >;
  recargos: CosteoTarifaRecargo[];
  /** Markup decimal aplicado a costo para sugerir precio_venta (0.15 = 15%). */
  markup: number;
  /** Cantidad por defecto, normalmente número de contenedores. */
  cantidad?: number;
  /** Tipo de embarque de la cotización (FCL/LCL). Cambia unidad de medida y label del flete. */
  tipoEmbarque?: "FCL" | "LCL" | string | null;
}

const aplicarMarkup = (costo: number, markup: number): number => {
  if (!Number.isFinite(costo) || costo <= 0) return 0;
  const factor = 1 + (Number.isFinite(markup) && markup >= 0 ? markup : 0);
  return roundMoney(costo * factor);
};

/** Filas de costo derivadas de los recargos de la tarifa (B-073: con linkage). */
function filasDesdeRecargos({
  recargos,
  tarifaId,
  proveedor,
  qty,
  unidad,
  markup,
}: {
  recargos: BuildCostosDesdeTarifaArgs["recargos"];
  tarifaId: string | null;
  proveedor: string;
  qty: number;
  unidad: string;
  markup: number;
}): FilaCostoLocal[] {
  const filas: FilaCostoLocal[] = [];
  for (const r of recargos) {
    const monto = Number(r.monto ?? 0);
    if (monto <= 0) continue;
    const ladoTxt = r.lado ? ` (${r.lado})` : "";
    filas.push({
      concepto: `${r.concepto}${ladoTxt}`,
      moneda: "USD",
      proveedor,
      cantidad: qty,
      costo_unitario: monto,
      precio_venta: aplicarMarkup(monto, markup),
      unidad_medida: unidad,
      aplica_iva: false,
      notas: "Auto-cargado desde tarifa marítima",
      // B-073: linkage tarifa + recargo (la RPC compara recargo por recargo).
      costeo_tarifa_id: tarifaId,
      costeo_tarifa_recargo_id: r.id ?? null,
    });
  }
  return filas;
}

export function buildCostosDesdeTarifa({
  tarifa,
  recargos,
  markup,
  cantidad = 1,
  tipoEmbarque,
}: BuildCostosDesdeTarifaArgs): FilaCostoLocal[] {
  const filas: FilaCostoLocal[] = [];
  const proveedor = tarifa.naviera_nombre ?? "";
  const esLcl = tipoEmbarque === "LCL";
  // LCL cotiza por volumen (m³ o W/M). FCL por contenedor. Blindaje AUD-LCL-1.
  const unidad = esLcl ? "m³" : "contenedor";

  // 13.142.8: la BD tiene un check `cotizacion_costos_cantidad_pos` que exige
  // `cantidad > 0`. Cuando el wizard aún no captura contenedores llega 0 y la
  // inserción explota. Normalizamos siempre a mínimo 1.
  const qty = Number.isFinite(cantidad) && cantidad >= 1 ? cantidad : 1;

  const fleteBase = Number(tarifa.flete_base ?? 0);
  if (fleteBase > 0) {
    // En LCL evitamos filtrar el nombre del contenedor (la tarifa hoy está
    // modelada para FCL y trae, p. ej., "20DRY", que confunde en un embarque LCL).
    const conceptoFlete = esLcl
      ? "Flete marítimo LCL"
      : `Flete marítimo (${tarifa.tipo_contenedor_nombre ?? ""})`.trim();
    filas.push({
      concepto: conceptoFlete,
      moneda: "USD",
      proveedor,
      cantidad: qty,
      costo_unitario: fleteBase,
      precio_venta: aplicarMarkup(fleteBase, markup),
      unidad_medida: unidad,
      aplica_iva: false,
      notas: "Auto-cargado desde tarifa marítima",
      // B-073: la fila de flete queda ligada a la tarifa para revalidar precio.
      costeo_tarifa_id: tarifa.id ?? null,
    });
  }

  filas.push(
    ...filasDesdeRecargos({ recargos, tarifaId: tarifa.id ?? null, proveedor, qty, unidad, markup }),
  );

  return filas;
}

