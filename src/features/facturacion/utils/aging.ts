/**
 * Buckets de antigüedad ("aging") para cartera vencida y por cobrar.
 *
 * v13.682.0 · UI-2 — el color YA NO se decide aquí: sale de la escala única
 * `@/lib/aging/buckets` (tokens `--aging-1..5`), así la misma deuda se ve
 * igual en Cobranza, Tesorería, CxC y CxP.
 *
 * Buckets vencido (nivel de la escala):
 *  - 1-30 d   → aging-2
 *  - 31-60 d  → aging-3
 *  - 61-90 d  → aging-4
 *  - 90+ d    → aging-5
 *
 * Buckets por cobrar (días para vencer, valor NEGATIVO en dias_vencido):
 *  - <= -8 d   → muted (holgado)
 *  - -7 a -1   → aging-1 (próximo a vencer)
 *  - 0         → aging-2 (vence hoy)
 */

import { AGING_SOLID_CLASS, nivelAgingDeDias } from "@/lib/aging/buckets";

export interface AgingBucket {
  label: string;
  className: string;
  ariaLabel: string;
}

export function agingVencidoBucket(dias: number): AgingBucket {
  const nivel = nivelAgingDeDias(dias);
  const rango =
    dias > 90 ? "más de 90 días" : dias > 60 ? "61 a 90 días" : dias > 30 ? "31 a 60 días" : "1 a 30 días";
  return {
    label: `${dias} d`,
    className: AGING_SOLID_CLASS[nivel],
    ariaLabel: `${dias} días vencido, ${rango}`,
  };
}

export function agingPorCobrarBucket(diasVencido: number): AgingBucket {
  // Convención de signo (ver `cobranza.ts`):
  //   diasVencido < 0  → aún faltan (-diasVencido) días para vencer.
  //   diasVencido = 0  → vence hoy.
  //   diasVencido > 0  → ya venció (defensa: aquí no debería llegar, pero lo mostramos).
  const faltan = -diasVencido;

  if (faltan < 0) {
    // Ya venció. Delegamos el color al bucket de vencidas para consistencia visual.
    const vencidos = -faltan;
    return {
      label: `${vencidos} d`,
      className: AGING_SOLID_CLASS[nivelAgingDeDias(vencidos)],
      ariaLabel: `Venció hace ${vencidos} días`,
    };
  }
  if (faltan === 0) {
    return {
      label: "Vence hoy",
      className: AGING_SOLID_CLASS[2],
      ariaLabel: "Vence hoy",
    };
  }
  if (faltan <= 7) {
    return {
      label: `${faltan} d`,
      className: AGING_SOLID_CLASS[1],
      ariaLabel: `Vence en ${faltan} días`,
    };
  }
  return {
    label: `${faltan} d`,
    className: "bg-muted text-muted-foreground",
    ariaLabel: `Vence en ${faltan} días`,
  };
}
