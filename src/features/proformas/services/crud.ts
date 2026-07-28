import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import { logger } from "@/lib/observability/logger";
import type { ProformaRow } from "./types";

export interface CrearProformaParams {
  organizationId: string;
  embarqueId: string;
  clienteId: string;
  clienteNombre: string;
  expediente: string;
  blMaster: string | null;
  conceptoIds: string[];
  totales: ReturnType<typeof calcularTotalesProforma>;
  notas: string | null;
  operador: string | null;
  diasCredito: number | null;
  tasaIva: number;
  ivaOverrides?: Record<string, boolean>;
}

export async function crearProforma(params: CrearProformaParams): Promise<ProformaRow> {
  if (params.conceptoIds.length === 0) {
    throw new Error("Debe seleccionar al menos un concepto");
  }

  // B-1: RPC atómica — update aplica_iva + insert proforma + vincular conceptos en una sola transacción.
  const rpcArgs = {
    p_organization_id: params.organizationId,
    p_embarque_id: params.embarqueId,
    p_cliente_id: params.clienteId,
    p_cliente_nombre: params.clienteNombre,
    p_expediente: params.expediente,
    p_bl_master: params.blMaster,
    p_concepto_ids: params.conceptoIds,
    p_subtotal_usd: params.totales.subtotal_usd,
    p_iva_usd: params.totales.iva_usd,
    p_total_usd: params.totales.total_usd,
    p_subtotal_mxn: params.totales.subtotal_mxn,
    p_iva_mxn: params.totales.iva_mxn,
    p_total_mxn: params.totales.total_mxn,
    p_notas: params.notas,
    p_operador: params.operador,
    p_dias_credito: params.diasCredito,
    p_tasa_iva: params.tasaIva,
    p_iva_overrides: (params.ivaOverrides ?? {}) as never,
    // SAFE-CAST: la RPC acepta NULL en bl_master/notas/operador/dias_credito y los tipos
    // generados por Supabase los exponen como required; el cast sólo cierra ese gap.
  } as unknown as Parameters<typeof supabase.rpc<"crear_proforma_atomica">>[1];
  const { data, error } = await Sentry.startSpan(
    { name: "rpc.crear_proforma_atomica", op: "db.rpc", attributes: { embarque_id: params.embarqueId } },
    () => supabase.rpc("crear_proforma_atomica", rpcArgs),
  );
  if (error) throw error;
  if (!data) throw new Error("No se pudo crear la proforma");
  // P3: métrica de negocio. Sólo monto agregado en MXN, sin cliente/RFC.
  try {
    Sentry.metrics?.distribution?.("proforma.total_mxn", params.totales.total_mxn, {
      unit: "none",
    });
  } catch (err) {
    // Sentry.metrics es best-effort (puede no existir en algunas versiones del SDK).
    // Reportar a Sentry aquí sería circular; nos limitamos a warning local.
    logger.warn("[crearProforma] Sentry.metrics falló:", err);
  }
  return fromDb<ProformaRow>(data);
}

export interface EliminarProformaParams {
  proformaId: string;
  embarqueId: string;
}

export async function eliminarProforma(params: EliminarProformaParams): Promise<void> {
  const { error: errUpd } = await supabase
    .from("conceptos_venta")
    .update({ estado_facturacion: "pendiente", proforma_id: null })
    .eq("proforma_id", params.proformaId);
  if (errUpd) throw errUpd;

  // v13.290.0 (Papelera Fase 3): soft-delete vía RPC para que la proforma
  // sea recuperable desde `/admin/papelera`.
  const { error: errDel } = await supabase.rpc("soft_delete_record", {
    _table: "proformas",
    _id: params.proformaId,
  });
  if (errDel) throw errDel;

  // B-3: NO actualizar embarques.tiene_proforma desde el cliente.
  // El trigger DB `trg_sync_embarque_tiene_proforma` lo maneja automáticamente al eliminar la proforma.
}

export async function aprobarProformas(proformaIds: string[]): Promise<void> {
  if (proformaIds.length === 0) throw new Error("Selecciona al menos una proforma");
  // `.select("id")` es intencional: si RLS filtra silenciosamente, Supabase
  // devuelve `data: []` sin `error`. Verificamos que se hayan actualizado
  // exactamente las filas solicitadas para no dar falsos positivos en la UI.
  const { data, error } = await supabase
    .from("proformas")
    .update({ estado_revision: "aprobada" })
    .in("id", proformaIds)
    // v13.321.6 — nunca aprobar proformas en papelera.
    .is("deleted_at", null)
    .select("id");
  if (error) throw error;
  const updated = data?.length ?? 0;
  if (updated !== proformaIds.length) {
    throw new Error(
      `No se pudo aprobar ${proformaIds.length - updated} de ${proformaIds.length} proforma(s). ` +
        "Verifica que tengas permisos suficientes (rol Admin / Admin Org / Contador / Operador).",
    );
  }
}

