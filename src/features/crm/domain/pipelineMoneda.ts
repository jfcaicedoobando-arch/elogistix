/**
 * UI-15 · Suma de importes CRM en pesos.
 *
 * El pipeline mezcla oportunidades en MXN, USD y EUR. Sumar `monto_estimado`
 * en crudo y rotularlo "MXN" mostraba una cifra sin significado (equivale a
 * sumar litros con galones). Este helper convierte cada renglón a pesos con el
 * tipo de cambio disponible y reporta si la cifra quedó estimada
 * (T/C de respaldo o moneda sin T/C), para que la UI lo advierta.
 */

export interface TipoCambioPipeline {
  usdMxn: number;
  eurMxn: number;
  esFallback?: boolean;
}

export interface ImporteMoneda {
  monto: number | null | undefined;
  moneda: string | null | undefined;
}

export interface SumaPipelineMxn {
  /** Total convertido a pesos (excluye lo que no se pudo convertir). */
  mxn: number;
  /** true cuando la conversión usó T/C de respaldo o quedaron montos sin convertir. */
  estimado: boolean;
  /** Importes en moneda extranjera que no se pudieron convertir. */
  sinConvertir: number;
}

function tcDe(moneda: string, tc: TipoCambioPipeline | null | undefined): number | null {
  if (!tc) return null;
  const valor = moneda === "USD" ? tc.usdMxn : moneda === "EUR" ? tc.eurMxn : null;
  return valor && valor > 0 ? valor : null;
}

export function sumarPipelineMxn(
  items: readonly ImporteMoneda[],
  tc: TipoCambioPipeline | null | undefined,
): SumaPipelineMxn {
  let mxn = 0;
  let sinConvertir = 0;
  let hayExtranjera = false;

  for (const item of items) {
    const monto = Number(item.monto ?? 0);
    if (!monto) continue;
    const moneda = (item.moneda ?? "MXN").toUpperCase();
    if (moneda === "MXN") {
      mxn += monto;
      continue;
    }
    hayExtranjera = true;
    const rate = tcDe(moneda, tc);
    if (rate === null) {
      sinConvertir += 1;
      continue;
    }
    mxn += monto * rate;
  }

  const estimado = hayExtranjera && (sinConvertir > 0 || tc?.esFallback === true);
  return { mxn: Math.round(mxn * 100) / 100, estimado, sinConvertir };
}
