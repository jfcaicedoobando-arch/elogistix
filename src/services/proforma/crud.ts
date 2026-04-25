import { supabase } from "@/integrations/supabase/client";
import { calcularTotalesProforma } from "@/lib/domain/proforma";
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

  if (params.ivaOverrides) {
    const updates = Object.entries(params.ivaOverrides).map(([id, aplica]) =>
      supabase.from("conceptos_venta").update({ aplica_iva: aplica }).eq("id", id),
    );
    const results = await Promise.all(updates);
    const firstErr = results.find((r) => r.error);
    if (firstErr?.error) throw firstErr.error;
  }

  const { data: numero, error: errNum } = await supabase.rpc("generar_numero_proforma", {
    p_org_id: params.organizationId,
  });
  if (errNum) throw errNum;

  const { data: proforma, error: errProf } = await supabase
    .from("proformas")
    .insert({
      numero: numero as string,
      embarque_id: params.embarqueId,
      cliente_id: params.clienteId,
      cliente_nombre: params.clienteNombre,
      expediente: params.expediente,
      bl_master: params.blMaster,
      subtotal_usd: params.totales.subtotal_usd,
      iva_usd: params.totales.iva_usd,
      total_usd: params.totales.total_usd,
      subtotal_mxn: params.totales.subtotal_mxn,
      iva_mxn: params.totales.iva_mxn,
      total_mxn: params.totales.total_mxn,
      notas: params.notas,
      operador: params.operador,
      dias_credito: params.diasCredito,
      organization_id: params.organizationId,
      tasa_iva_aplicada: params.tasaIva,
    })
    .select()
    .single();
  if (errProf) throw errProf;

  const { error: errUpd } = await supabase
    .from("conceptos_venta")
    .update({ estado_facturacion: "en_proforma", proforma_id: proforma.id })
    .in("id", params.conceptoIds);
  if (errUpd) {
    await supabase.from("proformas").delete().eq("id", proforma.id);
    throw errUpd;
  }

  return proforma as ProformaRow;
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

  const { error: errDel } = await supabase
    .from("proformas")
    .delete()
    .eq("id", params.proformaId);
  if (errDel) throw errDel;

  const { count, error: errCount } = await supabase
    .from("proformas")
    .select("id", { count: "exact", head: true })
    .eq("embarque_id", params.embarqueId);
  if (errCount) throw errCount;

  if ((count ?? 0) === 0) {
    const { error: errEmb } = await supabase
      .from("embarques")
      .update({ tiene_proforma: false })
      .eq("id", params.embarqueId);
    if (errEmb) throw errEmb;
  }
}

export async function aprobarProformas(proformaIds: string[]): Promise<void> {
  if (proformaIds.length === 0) throw new Error("Selecciona al menos una proforma");
  const { error } = await supabase
    .from("proformas")
    .update({ estado_revision: "aprobada" })
    .in("id", proformaIds);
  if (error) throw error;
}
