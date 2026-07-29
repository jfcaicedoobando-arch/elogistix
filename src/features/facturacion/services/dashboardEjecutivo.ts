/**
 * KPIs ejecutivos del módulo Facturación: facturado del mes,
 * cobrado del mes y tendencia de 6 meses (facturado vs cobrado en MXN
 * equivalente usando `tipo_cambio` de la factura).
 *
 * FIX C3c (S6-04): la agregación se hace en SQL (`dashboard_facturacion_kpis`).
 * Antes se traían hasta 15 000 filas al navegador y PostgREST podía truncarlas
 * en silencio (max-rows), dejando cifras mal sin ningún error visible.
 *
 * Política de conversión (canon C6, replicada en la RPC): moneda extranjera
 * con `tipo_cambio > 1` se convierte con él; si no hay TC confiable se usa el
 * fallback USD explícito; si tampoco, la factura se excluye del MXN
 * equivalente y se cuenta en `facturas_sin_tc` para que la UI advierta.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Estados que representan una factura efectivamente facturada (timbrada) para
 * los KPIs de "Facturado mes" y la tendencia. Excluye `Borrador` (aún no
 * timbrado) y `Cancelada` (revertida).
 *
 * NOTA: el filtro real vive dentro de la RPC `dashboard_facturacion_kpis`
 * (`f.estado IN ('Emitida','Parcialmente pagada','Vencida','Pagada')`); esta
 * constante se conserva como documentación/uso compartido en la UI.
 */
const ESTADOS_FACTURADO = ["Emitida", "Parcialmente pagada", "Vencida", "Pagada"] as const;

export interface MesKpi {
  mes: string; // 'YYYY-MM'
  facturado_mxn: number;
  cobrado_mxn: number;
}

export interface DashboardEjecutivoKpis {
  facturado_mes_mxn: number;
  cobrado_mes_mxn: number;
  tendencia: MesKpi[]; // últimos 6 meses (incluye el actual)
  /** Facturas USD del mes en curso sin tipo_cambio capturado ni fallback aplicable. */
  facturas_sin_tc: number;
}

/** Shape del jsonb devuelto por la RPC `dashboard_facturacion_kpis` (C3c). */
interface DashboardFacturacionRpc {
  tendencia: MesKpi[];
  facturas_sin_tc: number;
}

const MESES_TENDENCIA = 6;

/**
 * @param organizationId se conserva por compatibilidad de firma: el aislamiento
 *   multi-tenant lo aplica la RPC con `current_user_org_id()` (o super_admin).
 * @param hoy se conserva por compatibilidad: la RPC ancla "hoy" a CDMX en SQL.
 */
export async function fetchDashboardEjecutivoFacturacion(
  _organizationId: string | null,
  fallbackUsdMxn: number | null = null,
  _hoy: Date = new Date(),
): Promise<DashboardEjecutivoKpis> {
  const { data, error } = await supabase.rpc("dashboard_facturacion_kpis", {
    p_meses: MESES_TENDENCIA,
    p_fallback_usd: fallbackUsdMxn ?? undefined,
  });
  if (error) throw error;

  // SAFE-CAST: la RPC devuelve jsonb; el shape lo define la migración C3c.
  const payload = (data ?? { tendencia: [], facturas_sin_tc: 0 }) as unknown as DashboardFacturacionRpc;
  const tendencia = payload.tendencia ?? [];
  const actual = tendencia[tendencia.length - 1] ?? { facturado_mxn: 0, cobrado_mxn: 0 };

  return {
    facturado_mes_mxn: Number(actual.facturado_mxn) || 0,
    cobrado_mes_mxn: Number(actual.cobrado_mxn) || 0,
    tendencia,
    facturas_sin_tc: Number(payload.facturas_sin_tc) || 0,
  };
}
