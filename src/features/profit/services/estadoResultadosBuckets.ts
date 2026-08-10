/**
 * Ola 10 — Constructores puros de los buckets del Estado de Resultados
 * devengado (extraídos de `estadoResultadosDevengado.ts` para respetar el
 * límite de 200 líneas del Power-of-10 #4).
 *
 * Convierten filas de facturas, notas de crédito y facturas de proveedor en
 * "embarques sintéticos" + conceptos de venta/costo, resolviendo el tipo de
 * cambio con la precedencia: TC del embarque → TC del documento → TC del DOF.
 */
import { fallbackTC, type TcFallback } from "./estadoResultadosTc";
import type {
  EmbarqueER,
  ConceptoVentaER,
  ConceptoCostoER,
} from "@/features/profit/domain/estadoResultados";
import type {
  FacturaRow,
  NotaCreditoRow,
  ProveedorFacturaRow,
} from "@/lib/mappers/estadoResultadosRows";

export interface VentasBucket {
  embarques: EmbarqueER[];
  ventas: ConceptoVentaER[];
}

export interface CostosBucket {
  embarques: EmbarqueER[];
  costos: ConceptoCostoER[];
}

export function ingresosDeFacturas(
  facturas: FacturaRow[],
  embPorExp: Map<string, EmbarqueER>,
  out: VentasBucket,
  tc: TcFallback,
): void {
  for (const f of facturas) {
    const emb = f.expediente ? embPorExp.get(f.expediente) : undefined;
    const id = `fact-${f.id}`;
    out.embarques.push({
      id,
      modo: emb?.modo ?? "Marítimo",
      tipo_cambio_usd: emb?.tipo_cambio_usd ?? fallbackTC(Number(f.tipo_cambio), tc.usd),
      tipo_cambio_eur: emb?.tipo_cambio_eur ?? tc.eur,
    });
    out.ventas.push({
      embarque_id: id,
      descripcion: "Facturación",
      total: Number(f.total),
      moneda: String(f.moneda),
    });
  }
}

export function ingresosDeNotas(ncs: NotaCreditoRow[], out: VentasBucket, tc: TcFallback): void {
  for (const nc of ncs) {
    const id = `nc-${nc.factura_id}`;
    // Ola 9 · M6: usar el TC de la nota de crédito cuando exista; sólo caer al
    // TC del mes si la NC no lo tiene capturado.
    out.embarques.push({
      id,
      modo: "Marítimo",
      tipo_cambio_usd: fallbackTC(Number(nc.tipo_cambio ?? 0), tc.usd),
      tipo_cambio_eur: tc.eur,
    });
    out.ventas.push({
      embarque_id: id,
      descripcion: "Notas de crédito",
      total: -Math.abs(Number(nc.monto)),
      moneda: String(nc.moneda),
    });
  }
}

export function costosDeProveedorFacturas(
  pfacts: ProveedorFacturaRow[],
  embPorId: EmbarqueER[],
  out: CostosBucket,
  tc: TcFallback,
): void {
  for (const pf of pfacts) {
    const emb = pf.embarque_id ? embPorId.find((e) => e.id === pf.embarque_id) : undefined;
    const id = `pf-${pf.id}`;
    out.embarques.push({
      id,
      modo: emb?.modo ?? "Marítimo",
      tipo_cambio_usd: emb?.tipo_cambio_usd ?? fallbackTC(Number(pf.tipo_cambio_usd), tc.usd),
      tipo_cambio_eur: emb?.tipo_cambio_eur ?? tc.eur,
    });
    out.costos.push({
      embarque_id: id,
      concepto: "Facturas de proveedor",
      monto: Number(pf.total),
      moneda: String(pf.moneda),
    });
  }
}
