/**
 * Helper puro para describir un ajuste cotizado→facturado con lenguaje humano.
 * Fuente única de verdad usada por `AjusteChip`, `ResumenAjusteBar` y el header
 * de `GrupoCostosProveedor` para que las 3 superficies hablen igual.
 */
import type { ChipTone } from "@/lib/ui/badgeTone";
import { formatCurrency } from "@/lib/formatters";

export type AjusteKind = "sin_factura" | "sin_ajuste" | "ahorro" | "sobrecosto";

export interface AjusteDescripcion {
  kind: AjusteKind;
  tone: ChipTone;
  /** Símbolo direccional listo para renderizar (▼ ▲ =). */
  icono: "▼" | "▲" | "=" | "•";
  /** Frase corta: "Ahorro 36.80 · 19%", "Sin ajuste", "Sin factura". */
  titulo: string;
  /** Explicación completa, apta para tooltip. */
  detalle: string;
  /** Magnitud absoluta del ajuste. */
  monto: number;
  /** Porcentaje absoluto (0 si cotizado=0). */
  pct: number;
}

export function describirAjuste(
  cotizado: number,
  facturado: number,
  moneda: string,
  opts: { tieneFactura: boolean },
): AjusteDescripcion {
  if (!opts.tieneFactura) {
    return {
      kind: "sin_factura", tone: "neutral", icono: "•",
      titulo: "Sin factura",
      detalle: "El proveedor aún no factura este concepto.",
      monto: 0, pct: 0,
    };
  }
  const dif = facturado - cotizado;
  const abs = Math.abs(dif);
  const pct = cotizado > 0 ? (abs / cotizado) * 100 : 0;
  const importe = formatCurrency(abs, moneda);

  if (abs < 0.01) {
    return {
      kind: "sin_ajuste", tone: "neutral", icono: "=",
      titulo: "Sin ajuste",
      detalle: `El proveedor facturó exactamente lo cotizado (${formatCurrency(cotizado, moneda)}).`,
      monto: 0, pct: 0,
    };
  }
  if (dif < 0) {
    return {
      kind: "ahorro", tone: "success", icono: "▼",
      titulo: `Ahorro ${importe} · ${pct.toFixed(0)}%`,
      detalle: `El proveedor facturó ${importe} menos de lo cotizado (−${pct.toFixed(1)}%).`,
      monto: abs, pct,
    };
  }
  return {
    kind: "sobrecosto", tone: "destructive", icono: "▲",
    titulo: `Sobrecosto ${importe} · ${pct.toFixed(0)}%`,
    detalle: `El proveedor facturó ${importe} más de lo cotizado (+${pct.toFixed(1)}%).`,
    monto: abs, pct,
  };
}

/** Ajuste neto agregado para un conjunto de filas de una misma moneda. */
export function describirAjusteNeto(
  cotizado: number,
  facturado: number,
  moneda: string,
): AjusteDescripcion {
  // B-057 (v13.320.40): sin factura del proveedor NO es "ahorro" — es costo por
  // devengar. Sólo hay ajuste real cuando el proveedor ya facturó (facturado > 0).
  return describirAjuste(cotizado, facturado, moneda, { tieneFactura: facturado > 0 });
}
