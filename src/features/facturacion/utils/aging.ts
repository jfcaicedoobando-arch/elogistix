/**
 * Buckets de antigüedad ("aging") para cartera vencida y por cobrar.
 * Usa exclusivamente tokens semánticos (--warning, --destructive) para
 * respetar el sistema de diseño (light/dark automáticos).
 *
 * Buckets vencido:
 *  - 1-30 d   → warning suave
 *  - 31-60 d  → warning fuerte
 *  - 61-90 d  → destructive suave
 *  - 90+ d    → destructive fuerte
 *
 * Buckets por cobrar (días para vencer, valor NEGATIVO en dias_vencido):
 *  - <= -8 d   → info (holgado)
 *  - -7 a -1   → warning suave (próximo a vencer)
 *  - 0         → warning fuerte (vence hoy)
 */

export interface AgingBucket {
  label: string;
  className: string;
  ariaLabel: string;
}

export function agingVencidoBucket(dias: number): AgingBucket {
  if (dias > 90) {
    return {
      label: `${dias} d`,
      className: "bg-destructive text-destructive-foreground",
      ariaLabel: `${dias} días vencido, más de 90 días`,
    };
  }
  if (dias > 60) {
    return {
      label: `${dias} d`,
      className: "bg-destructive/70 text-destructive-foreground",
      ariaLabel: `${dias} días vencido, 61 a 90 días`,
    };
  }
  if (dias > 30) {
    return {
      label: `${dias} d`,
      className: "bg-warning text-warning-foreground",
      ariaLabel: `${dias} días vencido, 31 a 60 días`,
    };
  }
  return {
    label: `${dias} d`,
    className: "bg-warning/60 text-warning-foreground",
    ariaLabel: `${dias} días vencido, 1 a 30 días`,
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
      className: "bg-destructive/70 text-destructive-foreground",
      ariaLabel: `Venció hace ${vencidos} días`,
    };
  }
  if (faltan === 0) {
    return {
      label: "Vence hoy",
      className: "bg-warning text-warning-foreground",
      ariaLabel: "Vence hoy",
    };
  }
  if (faltan <= 7) {
    return {
      label: `${faltan} d`,
      className: "bg-warning/60 text-warning-foreground",
      ariaLabel: `Vence en ${faltan} días`,
    };
  }
  return {
    label: `${faltan} d`,
    className: "bg-muted text-muted-foreground",
    ariaLabel: `Vence en ${faltan} días`,
  };
}
