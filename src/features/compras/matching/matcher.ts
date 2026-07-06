/**
 * Motor de matching factura ↔ conceptos_costo pendientes.
 *
 * Modelo: la factura tiene una descripción principal (notas / folio) y un monto
 * total en una moneda. Los `conceptos_costo` abiertos del mismo proveedor son
 * candidatos. Rankea por score = 0.6·similitud + 0.4·cercanía_monto (−0.5 si
 * la moneda difiere).
 *
 * Devuelve, además del ranking, una **selección sugerida** (subset de conceptos
 * cuyo monto acumulado se acerca al monto de la factura sin excederlo > 5%,
 * priorizando score alto).
 */
import { scoreCompuesto } from "./similitud";

export interface FacturaResumen {
  descripcion: string;
  monto: number;
  moneda: string;
}

export interface ConceptoCandidato {
  id: string;
  concepto: string;
  monto: number;
  moneda: string;
  embarque_id: string;
}

export interface SugerenciaVinculo {
  conceptoId: string;
  concepto: string;
  monto: number;
  moneda: string;
  embarque_id: string;
  score: number;
  /** true si el score ≥ 0.75 (confianza alta, auto-aplicable). */
  fuerte: boolean;
}

export interface ResultadoSugerencias {
  ranking: SugerenciaVinculo[];
  /** Subset recomendado para pre-marcar. */
  seleccion: SugerenciaVinculo[];
  /** Suma de montos de la selección. */
  totalSeleccion: number;
  descartadosPorMoneda: number;
}

export const UMBRAL_FUERTE = 0.75;
export const UMBRAL_MINIMO = 0.5;
const TOLERANCIA_EXCESO = 1.05;

export function sugerirVinculos(
  factura: FacturaResumen,
  candidatos: ConceptoCandidato[],
): ResultadoSugerencias {
  const ranking: SugerenciaVinculo[] = candidatos.map((c) => {
    const score = scoreCompuesto({
      descripcionA: factura.descripcion,
      descripcionB: c.concepto,
      montoA: factura.monto,
      montoB: c.monto,
      monedaA: factura.moneda,
      monedaB: c.moneda,
    });
    return {
      conceptoId: c.id,
      concepto: c.concepto,
      monto: c.monto,
      moneda: c.moneda,
      embarque_id: c.embarque_id,
      score,
      fuerte: score >= UMBRAL_FUERTE,
    };
  });

  ranking.sort((a, b) => b.score - a.score);

  const descartadosPorMoneda = candidatos.filter(
    (c) => factura.moneda && c.moneda && c.moneda !== factura.moneda,
  ).length;

  // Selección: greedy — toma sugerencias por score descendente mientras no exceda
  // el monto de la factura por más de 5% y el score sea al menos ≥ UMBRAL_MINIMO.
  const seleccion: SugerenciaVinculo[] = [];
  let total = 0;
  const limite = factura.monto > 0 ? factura.monto * TOLERANCIA_EXCESO : Infinity;
  for (const s of ranking) {
    if (s.score < UMBRAL_MINIMO) break;
    if (s.moneda !== factura.moneda) continue;
    if (total + s.monto > limite) continue;
    seleccion.push(s);
    total += s.monto;
    // Si ya cubrimos ≥95% del monto, cortamos para no seguir agregando.
    if (factura.monto > 0 && total >= factura.monto * 0.95) break;
  }

  return {
    ranking,
    seleccion,
    totalSeleccion: total,
    descartadosPorMoneda,
  };
}
