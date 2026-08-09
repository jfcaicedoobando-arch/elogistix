/**
 * Agregaciones puras (sin I/O) para la proyección de facturación.
 */
import {
  sumarConceptosEnMxn,
  sumarConceptosEnUsd,
  type FilaProyeccion,
} from "@/features/facturacion/domain/proyeccionFacturacion";
import type { EmbarqueProyeccionRow } from "./fetchSources";

interface ConceptoAgg {
  monto: number;
  moneda: string;
}

export function indexarPorEmbarque(
  rows: {
    embarque_id: string;
    total?: number | null;
    monto?: number | null;
    moneda: string | null;
  }[],
  key: "total" | "monto",
): Map<string, ConceptoAgg[]> {
  const map = new Map<string, ConceptoAgg[]>();
  for (const r of rows) {
    const arr = map.get(r.embarque_id) ?? [];
    arr.push({ monto: Number(r[key] ?? 0), moneda: String(r.moneda ?? "MXN") });
    map.set(r.embarque_id, arr);
  }
  return map;
}

export function buildFilasProyeccion(
  embarques: EmbarqueProyeccionRow[],
  ventasMap: Map<string, ConceptoAgg[]>,
  costosMap: Map<string, ConceptoAgg[]>,
  facturadosSet: Set<string>,
): FilaProyeccion[] {
  return embarques.map<FilaProyeccion>((e) => {
    // Ola 5 · M5: sin TC capturado NO se asume 1 MXN = 1 USD/EUR. Se marca la
    // fila como `sin_tc` y las conversiones usan 0 para no inventar pesos.
    const tcUsdRaw = Number(e.tipo_cambio_usd ?? 0);
    const tcEurRaw = Number(e.tipo_cambio_eur ?? 0);
    const tcUsd = tcUsdRaw > 0 ? tcUsdRaw : 0;
    const tcEur = tcEurRaw > 0 ? tcEurRaw : 0;
    const v = ventasMap.get(e.id) ?? [];
    const c = costosMap.get(e.id) ?? [];
    return {
      embarque_id: e.id,
      expediente: e.expediente ?? "",
      cliente_nombre: e.cliente_nombre ?? "",
      operador: e.operador ?? "",
      eta: e.eta,
      contenedor: e.contenedor,
      tipo_cambio_usd: tcUsd,
      tipo_cambio_eur: tcEur,
      sin_tc: tcUsd === 0,
      tiene_proforma: !!e.tiene_proforma,
      tiene_factura_pdf: !!e.expediente && facturadosSet.has(e.expediente),
      venta_mxn: sumarConceptosEnMxn(v, tcUsd, tcEur),
      venta_usd: sumarConceptosEnUsd(v, tcUsd, tcEur),
      costo_mxn: sumarConceptosEnMxn(c, tcUsd, tcEur),
      costo_usd: sumarConceptosEnUsd(c, tcUsd, tcEur),
    };
  });
}
