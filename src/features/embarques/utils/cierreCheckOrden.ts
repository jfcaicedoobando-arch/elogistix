/**
 * v13.361.0 — Agrupa y ordena los checks de cierre por fase del ciclo de vida
 * del embarque. Función pura (sin React) para mantenerla testeable.
 */
import { FASES_CIERRE, type FaseCierre } from "./cierreCheckFases";
import { getCierreCheckMeta } from "./cierreCheckMeta";

export interface CheckCierreEntrada {
  regla: string;
  ok: boolean;
  detalle?: unknown;
}

export interface GrupoCierre {
  fase: FaseCierre;
  checks: CheckCierreEntrada[];
  okCount: number;
  total: number;
}

export function agruparChecksPorFase(checks: readonly CheckCierreEntrada[]): GrupoCierre[] {
  const grupos: GrupoCierre[] = [];

  for (const fase of FASES_CIERRE) {
    const items = checks
      .filter((c) => getCierreCheckMeta(c.regla).fase === fase.id)
      .sort((a, b) => {
        const ma = getCierreCheckMeta(a.regla);
        const mb = getCierreCheckMeta(b.regla);
        if (ma.orden !== mb.orden) return ma.orden - mb.orden;
        return ma.label.localeCompare(mb.label, "es-MX");
      });

    if (items.length === 0) continue;

    grupos.push({
      fase,
      checks: items,
      okCount: items.filter((c) => c.ok).length,
      total: items.length,
    });
  }

  return grupos;
}
