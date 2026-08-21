/**
 * Servicio de liquidaciones de comisión: lista, RPC de generación, registro de pago.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr } from "@/lib/supabase/response";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";

import type { Tables } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";
import { CAP_LISTA } from "@/constants/queryCaps";
import { ymMx } from "@/lib/date/mx";
import { roundMoney } from "@/lib/financial/financialUtils";

export type LiquidacionRow = Tables<"liquidaciones_comision">;

// v13.56.1 — Columnas explícitas (auditoría: evitar SELECT * en tablas financieras).
const LIQUIDACION_COLUMNS =
  "id, organization_id, vendedora_id, periodo, total_mxn, fecha_pago, metodo_pago, referencia, notas, estado, cancelada_at, motivo_cancelacion, creada_por, created_at, updated_at";

export async function fetchLiquidaciones(): Promise<LiquidacionRow[]> {
  return unwrapOr(
    supabase
      .from("liquidaciones_comision")
      .select(LIQUIDACION_COLUMNS)
      .order("periodo", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(CAP_LISTA),
    [],
  ) as Promise<LiquidacionRow[]>;
}

export interface GenerarLiquidacionParams {
  vendedora_id: string;
  periodo: string;
  organization_id: string;
  /** BL-05: llave de idempotencia por intento de submit (evita liquidaciones duplicadas). */
  request_id?: string;
}

// Decisión: la generación/pago de liquidaciones de comisión se registra bajo
// el módulo `facturacion` (más cercano a movimientos financieros hacia
// vendedoras); la config de vendedora vive en `usuarios`/`embarques`.
export async function generarLiquidacion(p: GenerarLiquidacionParams): Promise<string> {
  const data = await unwrap(
    supabase.rpc("generar_liquidacion_comision", {
      p_vendedora_id: p.vendedora_id,
      p_periodo: p.periodo,
      p_organization_id: p.organization_id,
      p_request_id: p.request_id,
    }),
  );
  const id = data as string;
  await registrarActividad({
    modulo: "facturacion",
    accion: "generar_liquidacion_comision",
    entidadId: id,
    detalles: { vendedora_id: p.vendedora_id, periodo: p.periodo },
  });
  return id;
}

export interface RegistrarPagoLiquidacionParams {
  id: string;
  fecha_pago: string;
  metodo_pago: string;
  referencia: string;
  notas?: string;
}

/**
 * Ola 2 · O2.6 — el pago se registra por RPC (no por UPDATE directo): la RPC
 * toma `FOR UPDATE`, rechaza liquidaciones ya pagadas o canceladas y marca el
 * estado. Antes un doble clic reescribía la fecha de pago sin protesta.
 */
export async function registrarPagoLiquidacion(p: RegistrarPagoLiquidacionParams): Promise<void> {
  await unwrap(
    supabase.rpc("registrar_pago_liquidacion", {
      p_liquidacion_id: p.id,
      p_fecha_pago: p.fecha_pago,
      p_metodo_pago: p.metodo_pago,
      p_referencia: p.referencia,
      p_notas: p.notas ?? undefined,
    }),
  );
  await registrarActividad({
    modulo: "facturacion",
    accion: "registrar_pago_liquidacion_comision",
    entidadId: p.id,
    detalles: { fecha_pago: p.fecha_pago, metodo_pago: p.metodo_pago },
  });
}

export interface CancelarLiquidacionParams {
  id: string;
  motivo: string;
}

/**
 * Ola 2 · O2.6 — cancelar una liquidación no pagada regresa sus comisiones a
 * `Devengada` para que puedan re-liquidarse en el periodo correcto.
 */
export async function cancelarLiquidacion(p: CancelarLiquidacionParams): Promise<void> {
  await unwrap(
    supabase.rpc("cancelar_liquidacion_comision", {
      p_liquidacion_id: p.id,
      p_motivo: p.motivo,
    }),
  );
  await registrarActividad({
    modulo: "facturacion",
    accion: "cancelar_liquidacion_comision",
    entidadId: p.id,
    detalles: { motivo: p.motivo },
  });
}


/**
 * BL-7: total liquidado del mes tomado de `liquidaciones_comision.fecha_pago`
 * (fecha real del pago a la vendedora). Antes el KPI sumaba comisiones cuyo
 * `created_at` (fecha de devengo) caía en el mes, así que una comisión de mayo
 * pagada en junio nunca aparecía como liquidada en junio.
 */
export async function fetchLiquidadoMxnPorMes(periodo?: string): Promise<number> {
  const mes = periodo && /^\d{4}-\d{2}$/.test(periodo) ? periodo : ymMx();
  const [anio, m] = mes.split("-").map(Number);
  const desde = `${mes}-01`;
  const hasta = `${String(m === 12 ? anio + 1 : anio).padStart(4, "0")}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;

  const rows = (await unwrapOr(
    supabase
      .from("liquidaciones_comision")
      .select("total_mxn")
      .not("fecha_pago", "is", null)
      .gte("fecha_pago", desde)
      .lt("fecha_pago", hasta)
      .limit(CAP_LISTA),
    [],
  )) as { total_mxn: number | null }[];

  // RN-BL-3: es un KPI de dinero; si PostgREST truncó, el total sería una
  // cifra muda más baja que la real. Mejor error visible que número falso.
  assertNotTruncated(rows, CAP_LISTA, "comisiones.fetchLiquidadoMxnPorMes");

  return roundMoney(rows.reduce((acc, r) => acc + Number(r.total_mxn ?? 0), 0));
}

