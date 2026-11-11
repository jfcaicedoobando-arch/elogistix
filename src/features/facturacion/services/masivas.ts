/**
 * Lecturas y mutaciones masivas de Facturas Emitidas.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import { mapWithConcurrency } from "@/lib/async/mapWithConcurrency";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { getErrorMessage } from "@/lib/errors";

export interface OpcionesFacturaMasiva {
  scope: ReturnType<typeof captureAuthOperationScope>;
  onProgress?: (completadas: number, total: number) => void;
}

export type ResultadoFacturaMasiva =
  | { facturaId: string; ok: true }
  | { facturaId: string; ok: false; error: string };

const CONCURRENCIA = 4;

export interface FacturaParaZip {
  id: string;
  numero: string;
  factura_pdf_url: string | null;
  factura_xml_url: string | null;
}

export async function fetchFacturasParaZip(
  ids: readonly string[],
  scope = captureAuthOperationScope(),
): Promise<FacturaParaZip[]> {
  if (ids.length === 0) return [];
  scope.assertCurrent();
  const query = supabase
    .from("facturas")
    .select("id, numero, factura_pdf_url, factura_xml_url").is("deleted_at", null)
    .in("id", ids);
  if (scope.organizationId) query.eq("organization_id", scope.organizationId);
  const { data, error } = await query;
  scope.assertCurrent();
  if (error) throw error;
  return data ?? [];
}

export async function reenviarFacturasMasivas(
  ids: readonly string[],
  { scope, onProgress }: OpcionesFacturaMasiva,
): Promise<ResultadoFacturaMasiva[]> {
  const { enviarCfdiFactura } = await import("./enviarCfdiEmail");
  const { ok, errores } = await mapWithConcurrency(ids, CONCURRENCIA, async (id) => {
    scope.assertCurrent();
    await enviarCfdiFactura(id);
  }, onProgress);
  scope.assertCurrent();
  const enviadas = new Set(ok.map(({ item }) => item));
  const erroresPorId = new Map(errores.map(({ item, error }) => [item, getErrorMessage(error)]));
  return ids.map((facturaId) => enviadas.has(facturaId)
    ? { facturaId, ok: true }
    : { facturaId, ok: false, error: erroresPorId.get(facturaId) ?? "No se pudo reenviar" });
}

export async function marcarFacturasComoEnviadas(
  ids: readonly string[],
  scope = captureAuthOperationScope(),
): Promise<ResultadoFacturaMasiva[]> {
  if (ids.length === 0) return [];
  scope.assertCurrent();
  const query = supabase
    .from("facturas")
    .update({ enviada_cliente_at: new Date().toISOString() })
    .is("deleted_at", null)
    .in("id", ids);
  if (scope.organizationId) query.eq("organization_id", scope.organizationId);
  const { data, error } = await query.select("id");
  scope.assertCurrent();
  if (error) throw error;
  const confirmadas = new Set((data ?? []).map(({ id }) => id));
  const facturaIds = ids.filter((id) => confirmadas.has(id));
  if (facturaIds.length > 0) {
    await registrarActividad({
      modulo: "facturacion",
      accion: "Marcó facturas como enviadas manualmente",
      entidadNombre: `${facturaIds.length} factura(s)`,
      detalles: { facturaIds },
      authScope: scope,
      organizationId: scope.organizationId ?? undefined,
    });
  }
  scope.assertCurrent();
  return ids.map((facturaId) => confirmadas.has(facturaId)
    ? { facturaId, ok: true }
    : { facturaId, ok: false, error: "No se confirmó el marcado" });
}
