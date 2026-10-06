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

function sinTipoCambio(conceptos: ConceptoAgg[], tcUsd: number, tcEur: number): boolean {
  return conceptos.some((x) => x.moneda.toUpperCase() === "USD" && tcUsd === 0)
    || conceptos.some((x) => x.moneda.toUpperCase() === "EUR" && tcEur === 0);
}

function tcValido(valor: number | null): number {
  return Number(valor) > 0 ? Number(valor) : 0;
}

/** La falta de TC impide valuar, pero nunca acredita trabajo sin facturar. */
function tieneVentaPendiente(pendiente: ConceptoAgg[] | undefined, mxn: number, usd: number): boolean {
  return pendiente ? pendiente.some((concepto) => concepto.monto > 0.005) : mxn > 0.005 || usd > 0.005;
}

export function buildFilasProyeccion(
  embarques: EmbarqueProyeccionRow[],
  ventasMap: Map<string, ConceptoAgg[]>,
  costosMap: Map<string, ConceptoAgg[]>,
  facturadosSet: Set<string>,
  opciones: {
    tcFacturaPorExpediente?: ReadonlyMap<string, number>;
    facturadasMap?: Map<string, ConceptoAgg[]>;
    pendientesMap?: Map<string, ConceptoAgg[]>;
  } = {},
): FilaProyeccion[] {
  const { tcFacturaPorExpediente = new Map(), facturadasMap = new Map() } = opciones;
  return embarques.map<FilaProyeccion>((e) => {
    // Ola 5 · M5: sin TC capturado NO se asume 1 MXN = 1 USD/EUR. Se marca la
    // fila como `sin_tc` y las conversiones usan 0 para no inventar pesos.
    const tcUsd = tcValido(e.tipo_cambio_usd);
    const tcEur = tcValido(e.tipo_cambio_eur);
    // AUD-ANALISIS-5: la venta usa el TC de la factura vigente (alineado con el
    // Tablero); sin factura USD conserva el TC del embarque. El costo sigue con
    // el TC del embarque.
    const tcVentaUsd = (e.expediente && tcFacturaPorExpediente.get(e.expediente)) || tcUsd;
    const v = ventasMap.get(e.id) ?? [];
    const c = costosMap.get(e.id) ?? [];
    const facturadas = facturadasMap.get(e.id) ?? [];
    const facturadaMxn = sumarConceptosEnMxn(facturadas, tcVentaUsd, tcEur);
    const facturadaUsd = sumarConceptosEnUsd(facturadas, tcVentaUsd, tcEur);
    const proyectadaMxn = sumarConceptosEnMxn(v, tcVentaUsd, tcEur);
    const proyectadaUsd = sumarConceptosEnUsd(v, tcVentaUsd, tcEur);
    const pendiente = opciones.pendientesMap?.get(e.id) ?? [];
    const pendienteMxn = opciones.pendientesMap
      ? sumarConceptosEnMxn(pendiente, tcUsd, tcEur) : Math.max(0, proyectadaMxn - facturadaMxn);
    const pendienteUsd = opciones.pendientesMap
      ? sumarConceptosEnUsd(pendiente, tcUsd, tcEur) : Math.max(0, proyectadaUsd - facturadaUsd);
    // RG14 (Ola 3): el badge "Sin TC" sólo aplica si hay conceptos en moneda
    // extranjera que requieran conversión; un embarque 100% MXN no lo necesita.
    const conceptos = [...v, ...c, ...facturadas];
    return {
      embarque_id: e.id,
      expediente: e.expediente ?? "",
      cliente_nombre: e.cliente_nombre ?? "",
      operador: e.operador ?? "",
      eta: e.eta,
      contenedor: e.contenedor,
      tipo_cambio_usd: tcUsd,
      tipo_cambio_eur: tcEur,
      sin_tc: sinTipoCambio(conceptos, tcUsd, tcEur),
      tiene_proforma: !!e.tiene_proforma,
      tiene_factura_pdf: facturadasMap.has(e.id) || (!!e.expediente && facturadosSet.has(e.expediente)),
      venta_mxn: facturadaMxn + pendienteMxn,
      venta_usd: facturadaUsd + pendienteUsd,
      venta_facturada_mxn: facturadaMxn,
      venta_facturada_usd: facturadaUsd,
      venta_pendiente_mxn: pendienteMxn,
      venta_pendiente_usd: pendienteUsd,
      tiene_venta_pendiente: tieneVentaPendiente(opciones.pendientesMap?.get(e.id), pendienteMxn, pendienteUsd),
      costo_mxn: sumarConceptosEnMxn(c, tcUsd, tcEur),
      costo_usd: sumarConceptosEnUsd(c, tcUsd, tcEur),
    };
  });
}
