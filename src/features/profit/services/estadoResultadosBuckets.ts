/**
 * Ola 10 — Constructores puros de los buckets del Estado de Resultados
 * devengado (extraídos de `estadoResultadosDevengado.ts` para respetar el
 * límite de 200 líneas del Power-of-10 #4).
 *
 * Convierten filas de facturas, notas de crédito y facturas de proveedor en
 * "embarques sintéticos" + conceptos de venta/costo.
 *
 * EERR-TC (v13.823.246): la precedencia del tipo de cambio es
 * TC del documento fiscal → TC del embarque → TC del DOF. El CFDI es el que se
 * timbró ante el SAT, así que su TC manda sobre el TC operativo del booking;
 * con el orden anterior el EERR no cuadraba contra Facturación ni CxC.
 *
 * EERR-MODO (v13.823.246): una fila sin embarque vinculado ya no se asume
 * "Marítimo" — cae en "Otros" para no inflar una columna de modo con importes
 * cuyo modo real es desconocido.
 */
import { tcDocumentoPorMoneda, type TcFallback } from "./estadoResultadosTc";
import { baseNcProveedor } from "@/lib/financial/baseNcProveedor";
import { NotaCreditoSinDesgloseError } from "@/lib/financial/baseNotaCredito";
import type {
  EmbarqueER,
  ConceptoVentaER,
  ConceptoCostoER,
} from "@/features/profit/domain/estadoResultados";
import type {
  FacturaRow,
  NotaCreditoRow,
  ProveedorFacturaRow,
  ProveedorNotaCreditoRow,
} from "@/lib/mappers/estadoResultadosRows";

/** Modo usado cuando la fila no tiene embarque vinculado (modo desconocido). */
const MODO_DESCONOCIDO = "Otros";

export interface VentasBucket {
  embarques: EmbarqueER[];
  ventas: ConceptoVentaER[];
}

export interface CostosBucket {
  notasSinBase?: string[];
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
    const tipos = tcDocumentoPorMoneda(f.moneda, f.tipo_cambio, {
      usd: emb?.tipo_cambio_usd ?? tc.usd, eur: emb?.tipo_cambio_eur ?? tc.eur,
    });
    out.embarques.push({
      id,
      modo: emb?.modo ?? MODO_DESCONOCIDO,
      tipo_cambio_usd: tipos.usd,
      tipo_cambio_eur: tipos.eur,
    });
    out.ventas.push({
      embarque_id: id,
      descripcion: "Facturación",
      // BL-06: base SIN IVA, alineada con la fuente por conceptos
      // (`conceptos_venta.total` no incluye IVA). Antes se usaba `f.total`
      // (con IVA) e inflaba ingresos ~16%.
      total: Number(f.subtotal),
      moneda: String(f.moneda),
    });
  }
}

export function ingresosDeNotas(
  ncs: NotaCreditoRow[],
  out: VentasBucket,
  tc: TcFallback,
  /**
   * BL-8: modo real del embarque de la factura padre (`factura_id` → modo).
   * Antes toda NC se contaba como "Marítimo" y desviaba el EERR por modo.
   */
  modoPorFactura: ReadonlyMap<string, string> = new Map(),
): void {
  const invalidas = ncs
    .filter((nc) => nc.subtotal === null || !Number.isFinite(nc.subtotal))
    .map(({ id, folio }) => ({ id, folio }));
  if (invalidas.length) throw new NotaCreditoSinDesgloseError(invalidas);
  for (const [indice, nc] of ncs.entries()) {
    const id = `nc-${nc.factura_id}-${indice}`;
    const tipos = tcDocumentoPorMoneda(nc.moneda, nc.tipo_cambio, tc);
    // Ola 9 · M6: usar el TC de la nota de crédito cuando exista; sólo caer al
    // TC del mes si la NC no lo tiene capturado.
    out.embarques.push({
      id,
      modo: modoPorFactura.get(nc.factura_id) ?? MODO_DESCONOCIDO,
      tipo_cambio_usd: tipos.usd,
      tipo_cambio_eur: tipos.eur,
    });
    out.ventas.push({
      embarque_id: id,
      descripcion: "Notas de crédito",
      total: -Math.abs(Number(nc.subtotal)),
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
    const tipos = tcDocumentoPorMoneda(pf.moneda, pf.tipo_cambio_usd, {
      usd: emb?.tipo_cambio_usd ?? tc.usd, eur: emb?.tipo_cambio_eur ?? tc.eur,
    });
    out.embarques.push({
      id,
      modo: emb?.modo ?? MODO_DESCONOCIDO,
      tipo_cambio_usd: tipos.usd,
      tipo_cambio_eur: tipos.eur,
    });
    out.costos.push({
      embarque_id: id,
      concepto: "Facturas de proveedor",
      // BL-06: base SIN IVA (el IVA acreditable no es costo operativo).
      monto: Number(pf.subtotal),
      moneda: String(pf.moneda),
    });
  }
}

/**
 * EERR-NCP (v13.823.246): las notas de crédito de proveedor aplicadas del mes
 * se restan del costo. El encabezado del servicio devengado ya prometía
 * "menos notas de crédito proveedor aplicadas", pero nunca se restaban y el
 * costo quedaba inflado.
 */
export function costosDeNotasProveedor(
  ncs: ProveedorNotaCreditoRow[],
  embPorId: EmbarqueER[],
  /** `proveedor_factura_id` → `embarque_id` de la factura padre. */
  embPorFacturaProv: ReadonlyMap<string, string>,
  out: CostosBucket,
  tc: TcFallback,
): void {
  for (const nc of ncs) {
    const subtotal = baseNcProveedor(nc.subtotal);
    if (subtotal === null) {
      (out.notasSinBase ??= []).push(nc.id);
      continue;
    }
    const embId = embPorFacturaProv.get(nc.proveedor_factura_id);
    const emb = embId ? embPorId.find((e) => e.id === embId) : undefined;
    const id = `pnc-${nc.id}`;
    const tipos = tcDocumentoPorMoneda(nc.moneda, nc.tipo_cambio, {
      usd: emb?.tipo_cambio_usd ?? tc.usd, eur: emb?.tipo_cambio_eur ?? tc.eur,
    });
    out.embarques.push({
      id,
      modo: emb?.modo ?? MODO_DESCONOCIDO,
      tipo_cambio_usd: tipos.usd,
      tipo_cambio_eur: tipos.eur,
    });
    out.costos.push({
      embarque_id: id,
      concepto: "Notas de crédito de proveedor",
      monto: -subtotal,
      moneda: String(nc.moneda),
    });
  }
}
