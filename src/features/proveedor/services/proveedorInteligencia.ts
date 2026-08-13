/**
 * Wrapper tipado de la RPC `proveedor_inteligencia` (Ola 4).
 * Mapea el jsonb de la RPC al shape del dominio, sin `any`.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  AlertasProveedor,
  ComparativoConcepto,
  InteligenciaProveedor,
  PuntoTendencia,
  ScorecardProveedor,
  TopConcepto,
  TopRuta,
} from "@/features/proveedor/domain/inteligenciaProveedor";

type Raw = Record<string, unknown>;

const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const num = (v: unknown): number => Number(v ?? 0) || 0;
const nullableNum = (v: unknown): number | null => (v == null ? null : Number(v));
const str = (v: unknown): string => String(v ?? "");

function mapScorecard(raw: Raw): ScorecardProveedor {
  return {
    partidasTotal: num(raw.partidas_total),
    partidasFacturadas: num(raw.partidas_facturadas),
    comprometidoMxn: num(raw.comprometido_mxn),
    facturadoMxn: num(raw.facturado_mxn),
    comprometidoLigadoMxn: num(raw.comprometido_ligado_mxn),
    diasFacturacionProm: nullableNum(raw.dias_facturacion_prom),
    facturasCount: num(raw.facturas_count),
    ticketPromedioMxn: nullableNum(raw.ticket_promedio_mxn),
    topConceptos: arr(raw.top_conceptos).map<TopConcepto>((c) => ({
      concepto: str(c.concepto),
      montoMxn: num(c.monto_mxn),
      partidas: num(c.partidas),
    })),
    topRutas: arr(raw.top_rutas).map<TopRuta>((r) => ({
      ruta: str(r.ruta),
      montoMxn: num(r.monto_mxn),
      embarques: num(r.embarques),
    })),
  };
}

function mapAlertas(raw: Raw): AlertasProveedor {
  const bucket = (v: unknown) => ({ count: num(obj(v).count), montoMxn: num(obj(v).monto_mxn) });
  return {
    cerradosSinFactura: bucket(raw.cerrados_sin_factura),
    facturasPorVencer: bucket(raw.facturas_por_vencer),
    facturasVencidas: bucket(raw.facturas_vencidas),
    saldoPendienteMxn: num(raw.saldo_pendiente_mxn),
    bancariosIncompletos: raw.bancarios_incompletos === true,
    documentosVencidos: num(raw.documentos_vencidos),
    documentosPorVencer: num(raw.documentos_por_vencer),
  };
}

export async function fetchProveedorInteligencia(proveedorId: string): Promise<InteligenciaProveedor> {
  const { data, error } = await supabase.rpc("proveedor_inteligencia", {
    p_proveedor_id: proveedorId,
  });
  if (error) throw error;

  // SAFE-CAST: la RPC devuelve jsonb tipado como `Json`; validamos campo por campo.
  const raw = obj(data);
  const tc = obj(raw.tc);

  return {
    tc: {
      usdMxn: nullableNum(tc.usd_mxn),
      eurMxn: nullableNum(tc.eur_mxn),
      faltante: tc.faltante === true,
    },
    tipoProveedor: raw.tipo_proveedor == null ? null : str(raw.tipo_proveedor),
    scorecard: mapScorecard(obj(raw.scorecard)),
    tendencia: arr(raw.tendencia).map<PuntoTendencia>((p) => ({
      mes: str(p.mes),
      comprometido: num(p.comprometido),
      facturado: num(p.facturado),
      pagado: num(p.pagado),
    })),
    comparativo: arr(raw.comparativo).map<ComparativoConcepto>((c) => ({
      concepto: str(c.concepto),
      moneda: str(c.moneda) || "MXN",
      unitarioPropio: num(c.unitario_propio),
      opsPropias: num(c.ops_propias),
      unitarioOtros: num(c.unitario_otros),
      opsOtros: num(c.ops_otros),
      proveedoresComparados: num(c.proveedores_comparados),
    })),
    alertas: mapAlertas(obj(raw.alertas)),
  };
}
