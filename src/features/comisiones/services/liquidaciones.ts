/**
 * Servicio de liquidaciones de comisión: lista, RPC de generación, registro de pago.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";

export type LiquidacionRow = Tables<"liquidaciones_comision">;

// v13.56.1 — Columnas explícitas (auditoría: evitar SELECT * en tablas financieras).
const LIQUIDACION_COLUMNS =
  "id, organization_id, vendedora_id, periodo, total_mxn, fecha_pago, metodo_pago, referencia, notas, creada_por, created_at, updated_at";

export async function fetchLiquidaciones(): Promise<LiquidacionRow[]> {
  return unwrapOr(
    supabase
      .from("liquidaciones_comision")
      .select(LIQUIDACION_COLUMNS)
      .order("periodo", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    [],
  ) as Promise<LiquidacionRow[]>;
}

export interface GenerarLiquidacionParams {
  vendedora_id: string;
  periodo: string;
  organization_id: string;
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

export async function registrarPagoLiquidacion(p: RegistrarPagoLiquidacionParams): Promise<void> {
  const changes: TablesUpdate<"liquidaciones_comision"> = {
    fecha_pago: p.fecha_pago,
    metodo_pago: p.metodo_pago,
    referencia: p.referencia,
    notas: p.notas ?? null,
  };
  await run(supabase.from("liquidaciones_comision").update(changes).eq("id", p.id));
  await registrarActividad({
    modulo: "facturacion",
    accion: "registrar_pago_liquidacion_comision",
    entidadId: p.id,
    detalles: { fecha_pago: p.fecha_pago, metodo_pago: p.metodo_pago },
  });
}
