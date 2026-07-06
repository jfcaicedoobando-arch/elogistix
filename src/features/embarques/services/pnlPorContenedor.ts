/**
 * P&L por contenedor (v13.66.14) — modelo CargoWise.
 *
 * 1 embarque = 1 expediente. El contenedor es entidad operativa, NO centro de
 * utilidad independiente. Esta función reparte costos y ventas entre los
 * contenedores del embarque:
 *
 *   - Conceptos con `contenedor_id` asignado → directo a ese contenedor.
 *   - Conceptos con `contenedor_id = NULL` (o apuntando a un contenedor borrado)
 *     → "generales", se prorratean flat (÷N) entre los contenedores activos.
 *
 * Regla del residuo: cuando `monto / N` no es entero a 2 decimales, el último
 * contenedor recibe el residuo para que la suma cuadre exactamente al centavo
 * contra la P&L global.
 *
 * Sin mezclas de moneda: el resultado regresa una sub-tabla por moneda.
 */

import type { EmbarqueContenedor } from "@/features/embarques/types/contenedor";
import type {
  ConceptoVentaRow,
  ConceptoCostoRow,
} from "@/features/embarques/types/embarque";
import { formatSubexpediente } from "@/features/embarques/domain/embarque/subexpediente";
import {
  round2,
  calcMargen,
  repartirFlat,
  isActivo,
  type AcumuladorContenedor,
} from "./pnlPorContenedor.helpers";

export interface FilaPnlContenedor {
  contenedorId: string | null; // null = fila "Generales" o "Total"
  subexpediente: string;       // ej. "ELIMP00272-01", "Generales", "Total"
  numeroContenedor: string;
  tipoContenedor: string;
  ventaDirecta: number;
  ventaProrrateada: number;
  ventaTotal: number;
  costoDirecto: number;
  costoProrrateado: number;
  costoTotal: number;
  utilidad: number;
  margenPct: number; // 0–100
  esTotal?: boolean;
  esGenerales?: boolean;
}

export interface PnlPorContenedorPorMoneda {
  [moneda: string]: FilaPnlContenedor[];
}

export interface CalcularPnlInput {
  expediente: string;
  contenedores: ReadonlyArray<EmbarqueContenedor>;
  conceptosVenta: ReadonlyArray<ConceptoVentaRow>;
  conceptosCosto: ReadonlyArray<ConceptoCostoRow>;
}

export function calcularPnlPorContenedor(
  input: CalcularPnlInput,
): PnlPorContenedorPorMoneda {
  const { expediente, contenedores, conceptosVenta, conceptosCosto } = input;

  const hijosActivos = contenedores.filter(isActivo);
  const idsActivos = new Set(hijosActivos.map((c) => c.id));

  const ventasActivas = conceptosVenta.filter(isActivo);
  const costosActivos = conceptosCosto.filter(isActivo);

  // Monedas presentes en cualquiera de las dos colecciones.
  const monedas = new Set<string>();
  ventasActivas.forEach((v) => monedas.add(v.moneda));
  costosActivos.forEach((c) => monedas.add(c.moneda));

  const resultado: PnlPorContenedorPorMoneda = {};

  for (const moneda of monedas) {
    const ventasMon = ventasActivas.filter((v) => v.moneda === moneda);
    const costosMon = costosActivos.filter((c) => c.moneda === moneda);

    // Acumular directos por contenedor.
    const acumPorId = new Map<string, AcumuladorContenedor>();
    hijosActivos.forEach((c) =>
      acumPorId.set(c.id, { ventaDirecta: 0, costoDirecto: 0 }),
    );

    let ventaGeneral = 0;
    let costoGeneral = 0;

    for (const v of ventasMon) {
      const total = Number(v.total ?? 0);
      if (v.contenedor_id && idsActivos.has(v.contenedor_id)) {
        const acc = acumPorId.get(v.contenedor_id)!;
        acc.ventaDirecta = round2(acc.ventaDirecta + total);
      } else {
        ventaGeneral = round2(ventaGeneral + total);
      }
    }
    for (const c of costosMon) {
      const monto = Number(c.monto ?? 0);
      if (c.contenedor_id && idsActivos.has(c.contenedor_id)) {
        const acc = acumPorId.get(c.contenedor_id)!;
        acc.costoDirecto = round2(acc.costoDirecto + monto);
      } else {
        costoGeneral = round2(costoGeneral + monto);
      }
    }

    const n = hijosActivos.length;
    const ventaPartes = n > 0 ? repartirFlat(ventaGeneral, n) : [];
    const costoPartes = n > 0 ? repartirFlat(costoGeneral, n) : [];

    const filas: FilaPnlContenedor[] = [];

    // Ordenar contenedores por `orden` ascendente para consistencia visual.
    const hijosOrdenados = [...hijosActivos].sort(
      (a, b) => (a.orden ?? 0) - (b.orden ?? 0),
    );

    let totalVenta = 0;
    let totalCosto = 0;

    hijosOrdenados.forEach((c, idx) => {
      const acc = acumPorId.get(c.id)!;
      const ventaProrrateada = ventaPartes[idx] ?? 0;
      const costoProrrateado = costoPartes[idx] ?? 0;
      const ventaTotal = round2(acc.ventaDirecta + ventaProrrateada);
      const costoTotal = round2(acc.costoDirecto + costoProrrateado);
      const utilidad = round2(ventaTotal - costoTotal);
      filas.push({
        contenedorId: c.id,
        subexpediente: formatSubexpediente(expediente, c.orden ?? idx + 1),
        numeroContenedor: c.numero_contenedor || "—",
        tipoContenedor: c.tipo_contenedor || "—",
        ventaDirecta: acc.ventaDirecta,
        ventaProrrateada,
        ventaTotal,
        costoDirecto: acc.costoDirecto,
        costoProrrateado,
        costoTotal,
        utilidad,
        margenPct: calcMargen(utilidad, ventaTotal),
      });
      totalVenta = round2(totalVenta + ventaTotal);
      totalCosto = round2(totalCosto + costoTotal);
    });

    // Fila "Generales" (auditabilidad — antes del prorrateo).
    const tieneGenerales = ventaGeneral !== 0 || costoGeneral !== 0;
    if (tieneGenerales || n === 0) {
      const ventaTotal = ventaGeneral;
      const costoTotal = costoGeneral;
      const utilidad = round2(ventaTotal - costoTotal);
      filas.push({
        contenedorId: null,
        subexpediente: "Generales (sin asignar)",
        numeroContenedor: "—",
        tipoContenedor: "—",
        ventaDirecta: 0,
        ventaProrrateada: 0,
        ventaTotal,
        costoDirecto: 0,
        costoProrrateado: 0,
        costoTotal,
        utilidad,
        margenPct: calcMargen(utilidad, ventaTotal),
        esGenerales: true,
      });
      if (n === 0) {
        totalVenta = round2(totalVenta + ventaTotal);
        totalCosto = round2(totalCosto + costoTotal);
      }
    }

    // Fila Total (suma de los contenedores; ya incluye los generales prorrateados).
    const utilidadTotal = round2(totalVenta - totalCosto);
    filas.push({
      contenedorId: null,
      subexpediente: "Total embarque",
      numeroContenedor: "",
      tipoContenedor: "",
      ventaDirecta: 0,
      ventaProrrateada: 0,
      ventaTotal: totalVenta,
      costoDirecto: 0,
      costoProrrateado: 0,
      costoTotal: totalCosto,
      utilidad: utilidadTotal,
      margenPct: calcMargen(utilidadTotal, totalVenta),
      esTotal: true,
    });

    resultado[moneda] = filas;
  }

  return resultado;
}
