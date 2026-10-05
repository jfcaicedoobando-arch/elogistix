/** Lectura y cálculo compartidos por el EERR devengado mensual y anual. */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr } from "@/lib/supabase/response";
import { fetchInChunks } from "@/lib/supabase/chunkedIn";
import { FACTURA_ESTADOS_VIVOS } from "@/lib/domain/estadosFactura";
import { tcFallbackDof, type TcFallback } from "./estadoResultadosTc";
import {
  ingresosDeFacturas, ingresosDeNotas, costosDeProveedorFacturas, costosDeNotasProveedor,
  type VentasBucket, type CostosBucket,
} from "./estadoResultadosBuckets";
import { buildEstadoResultados, type EmbarqueER } from "@/features/profit/domain/estadoResultados";
import type {
  FacturaRow, NotaCreditoRow, ProveedorFacturaRow, ProveedorNotaCreditoRow,
} from "@/lib/mappers/estadoResultadosRows";
import {
  fetchFacturasMes, fetchNotasCreditoMes, fetchProveedorFacturasMes, fetchProveedorNotasCreditoMes,
  loadEmbarqueIdsPorFacturaProveedor, loadEmbarquesPorExpedientes, loadEmbarquesPorIds,
} from "./estadoResultadosFetch";

interface DatosDevengados {
  facturas: FacturaRow[];
  ncs: NotaCreditoRow[];
  pfacts: ProveedorFacturaRow[];
  pncs: ProveedorNotaCreditoRow[];
  tc: TcFallback;
  embPorExp: Map<string, EmbarqueER>;
  embPorId: EmbarqueER[];
  embPorFacturaProv: Map<string, string>;
  modoNc: Map<string, string>;
}

/** Resuelve el modo de las NC, incluidas las de facturas fuera del rango. */
async function modoPorFacturaDeNotas(
  ncs: NotaCreditoRow[], facturas: FacturaRow[], embPorExp: Map<string, EmbarqueER>,
  organizationId: string | null,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const idsNc = new Set(ncs.map((n) => n.factura_id).filter(Boolean));
  if (idsNc.size === 0) return out;
  const expPorFactura = new Map<string, string | null>();
  for (const f of facturas) {
    if (idsNc.has(f.id)) expPorFactura.set(f.id, f.expediente ?? null);
  }
  const faltantes = [...idsNc].filter((id) => !expPorFactura.has(id));
  const data = await fetchInChunks(faltantes, (ids) => unwrapOr(supabase.from("facturas")
    .select("id, expediente").in("id", ids)
    .in("estado", [...FACTURA_ESTADOS_VIVOS]).is("deleted_at", null), []));
  for (const row of data) expPorFactura.set(row.id, row.expediente ?? null);
  const expsFaltantes = Array.from(new Set(
    Array.from(expPorFactura.values()).filter(
      (e): e is string => typeof e === "string" && e.length > 0 && !embPorExp.has(e),
    ),
  ));
  const extra = await loadEmbarquesPorExpedientes(expsFaltantes, organizationId);
  for (const [facturaId, exp] of expPorFactura) {
    if (!exp) continue;
    const emb = embPorExp.get(exp) ?? extra.get(exp);
    if (emb?.modo) out.set(facturaId, emb.modo);
  }
  return out;
}

export async function cargarDatosDevengados(
  organizationId: string | null, desde: string, hasta: string,
): Promise<DatosDevengados> {
  const [facturas, ncs, pfacts, pncs, tc] = await Promise.all([
    fetchFacturasMes(organizationId, desde, hasta),
    fetchNotasCreditoMes(organizationId, desde, hasta),
    fetchProveedorFacturasMes(organizationId, desde, hasta),
    fetchProveedorNotasCreditoMes(organizationId, desde, hasta),
    tcFallbackDof(),
  ]);
  const embPorFacturaProv = await loadEmbarqueIdsPorFacturaProveedor(
    Array.from(new Set(pncs.map((n) => n.proveedor_factura_id).filter(Boolean))),
  );
  const exps = Array.from(new Set(facturas.flatMap((f) => f.expediente ? [f.expediente] : [])));
  const embIds = Array.from(new Set([
    ...pfacts.flatMap((f) => f.embarque_id ? [f.embarque_id] : []), ...embPorFacturaProv.values(),
  ]));
  const [embPorExp, embPorId] = await Promise.all([
    loadEmbarquesPorExpedientes(exps, organizationId), loadEmbarquesPorIds(embIds),
  ]);
  const modoNc = await modoPorFacturaDeNotas(ncs, facturas, embPorExp, organizationId);
  return { facturas, ncs, pfacts, pncs, tc, embPorExp, embPorId, embPorFacturaProv, modoNc };
}

/** El mismo pivot aplica impuestos, NC, redondeo y conversión a ambos alcances. */
export function construirEstadoDevengado(datos: DatosDevengados) {
  const { facturas, ncs, pfacts, pncs, tc, embPorExp, embPorId, embPorFacturaProv, modoNc } = datos;
  const ventas: VentasBucket = { embarques: [], ventas: [] };
  ingresosDeFacturas(facturas, embPorExp, ventas, tc);
  ingresosDeNotas(ncs, ventas, tc, modoNc);
  const costos: CostosBucket = { embarques: [], costos: [] };
  costosDeProveedorFacturas(pfacts, embPorId, costos, tc);
  costosDeNotasProveedor(pncs, embPorId, embPorFacturaProv, costos, tc);
  return buildEstadoResultados(
    [...ventas.embarques, ...costos.embarques], ventas.ventas, costos.costos,
  );
}
