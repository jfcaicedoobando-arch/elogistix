/**
 * v13.503.0 — Cotejo del monto que el proveedor facturó contra lo costeado en
 * el embarque (costos vivos del mismo proveedor y la misma moneda).
 *
 * Es un aviso, NO un bloqueo: operaciones puede enviar el documento al buzón
 * aunque haya diferencia; contabilidad lo verá señalado al capturarlo.
 */
import { roundMoney } from "@/lib/financial/financialUtils";

/** Tolerancia: 1% del costeado, con piso de $1 (float drift / centavos). */
export const TOLERANCIA_MONTO_MINIMA = 1;
export const TOLERANCIA_MONTO_PORCENTAJE = 0.01;

export type EstadoCotejoMonto = "coincide" | "difiere" | "sin_datos";

export interface CotejoMonto {
  estado: EstadoCotejoMonto;
  /** Facturado − costeado (positivo = el proveedor facturó de más). */
  diferencia: number;
  /** Diferencia relativa al costeado, en fracción (0.2 = 20%). */
  porcentaje: number;
  /** Suma de costos vivos del proveedor en esa moneda (null si no hay). */
  costeado: number | null;
}

export interface CotejoMontoArgs {
  monto: number | null;
  moneda: string;
  /** Suma de costos vivos del proveedor por moneda: { USD: 1000 }. */
  costeadoPorMoneda: Readonly<Record<string, number>> | null | undefined;
}

const SIN_DATOS: CotejoMonto = {
  estado: "sin_datos",
  diferencia: 0,
  porcentaje: 0,
  costeado: null,
};

/** Compara el monto declarado contra el costeado en la misma moneda. */
export function cotejarMontoFacturado({
  monto,
  moneda,
  costeadoPorMoneda,
}: CotejoMontoArgs): CotejoMonto {
  if (monto == null || !Number.isFinite(monto) || monto <= 0) return SIN_DATOS;
  const costeado = costeadoPorMoneda?.[moneda];
  if (costeado == null || !Number.isFinite(costeado) || costeado <= 0) return SIN_DATOS;

  const diferencia = roundMoney(monto - costeado);
  const tolerancia = Math.max(
    TOLERANCIA_MONTO_MINIMA,
    roundMoney(costeado * TOLERANCIA_MONTO_PORCENTAJE),
  );
  return {
    estado: Math.abs(diferencia) <= tolerancia ? "coincide" : "difiere",
    diferencia,
    porcentaje: costeado === 0 ? 0 : diferencia / costeado,
    costeado: roundMoney(costeado),
  };
}

/** True cuando el monto capturado a mano no cuadra con el total del CFDI. */
export function montoDifiereDelCfdi(
  monto: number | null,
  totalCfdi: number | null | undefined,
): boolean {
  if (monto == null || totalCfdi == null) return false;
  if (!Number.isFinite(monto) || !Number.isFinite(totalCfdi)) return false;
  return roundMoney(Math.abs(monto - totalCfdi)) > 0.01;
}

/**
 * ¿El monto capturado se separó del total del CFDI? Usamos la misma tolerancia
 * mínima ($1) porque son el mismo documento: cualquier diferencia real importa.
 */
export function montoDifiereDelCfdi(
  monto: number | null,
  totalCfdi: number | null,
): boolean {
  if (monto == null || totalCfdi == null) return false;
  if (!Number.isFinite(monto) || !Number.isFinite(totalCfdi)) return false;
  return Math.abs(roundMoney(monto - totalCfdi)) > TOLERANCIA_MONTO_MINIMA;
}
