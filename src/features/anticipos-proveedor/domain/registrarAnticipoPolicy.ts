/**
 * Políticas puras del formulario "Registrar anticipo a proveedor".
 *
 * Vivían dentro de `useEffect`/`useMemo` del diálogo (Ola auditoría · punto 4):
 * eran reglas de negocio (sugerir T/C, autoseleccionar cuenta, convertir a MXN)
 * escondidas en la capa de UI y por lo tanto no testeables de forma aislada.
 */
import type { Moneda } from "@/types/db";

export type MonedaAnticipo = Moneda;

/** Subconjunto de `TcInicial` que estas reglas necesitan (dominio sin acoplarse al hook). */
export interface TcSugeridoInput {
  usdMxn: number;
  eurMxn: number | null;
  esFallback: boolean;
  eurEsFallback: boolean;
}

/** Cuenta bancaria mínima requerida para preseleccionar por moneda. */
export interface CuentaMonedaInput {
  id: string;
  moneda: string;
}

/**
 * T/C que se puede sugerir al usuario para la moneda dada.
 *
 * EF-04: si el T/C disponible es un fallback estimado NO se sugiere nada — el
 * usuario debe capturar el T/C real (DOF/Banxico) a mano.
 */
export function tcSugeridoParaMoneda(
  moneda: MonedaAnticipo,
  tc: TcSugeridoInput | null | undefined,
): number | null {
  if (!tc || moneda === "MXN") return null;
  if (moneda === "EUR") {
    if (tc.eurEsFallback) return null;
    return Number(tc.eurMxn) > 0 ? Number(tc.eurMxn) : null;
  }
  if (tc.esFallback) return null;
  return Number(tc.usdMxn) > 0 ? Number(tc.usdMxn) : null;
}

/** ¿Debe escribirse el T/C sugerido? Solo si el usuario no capturó uno válido. */
export function debeSugerirTc(
  tcCapturado: number | string | null | undefined,
  sugerido: number | null,
): sugerido is number {
  return Boolean(sugerido) && !(Number(tcCapturado) > 0);
}

/** Cuentas bancarias que coinciden con la moneda del anticipo. */
export function cuentasDeMoneda<T extends CuentaMonedaInput>(
  cuentas: readonly T[],
  moneda: MonedaAnticipo,
): T[] {
  return cuentas.filter((c) => c.moneda === moneda);
}

/**
 * Cuenta bancaria que debe quedar seleccionada.
 * - `""` limpia la selección cuando la cuenta elegida ya no coincide con la moneda.
 * - id de la primera cuenta compatible cuando no hay nada seleccionado.
 * - `null` significa "no cambiar nada".
 */
export function resolverCuentaBancaria(
  cuentaActual: string | undefined,
  compatibles: readonly CuentaMonedaInput[],
): string | null {
  if (cuentaActual) {
    return compatibles.some((c) => c.id === cuentaActual) ? null : "";
  }
  return compatibles.length > 0 ? compatibles[0].id : null;
}

/** Equivalente en pesos del monto capturado (null si aún no es calculable). */
export function equivalenteMxnAnticipo(
  monto: number | string | null | undefined,
  moneda: MonedaAnticipo,
  tipoCambio: number | string | null | undefined,
): number | null {
  const m = Number(monto);
  if (!(m > 0)) return null;
  if (moneda === "MXN") return m;
  const t = Number(tipoCambio);
  return t > 0 ? m * t : null;
}
