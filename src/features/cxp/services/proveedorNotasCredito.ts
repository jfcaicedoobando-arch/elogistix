/**
 * Notas de crédito de proveedor — CRUD y aplicación contra facturas.
 * Máquina de estados (enforced en BD por `trg_nc_prov_estado_machine`):
 *   Borrador  → Aprobada, Cancelada
 *   Aprobada  → Aplicada, Cancelada
 *   Aplicada  → Cancelada (revert)
 *   Cancelada → terminal
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";
import { unwrapOr } from "@/lib/supabase/response";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";

export type NotaCreditoProveedor = Tables<"proveedor_notas_credito">;

/**
 * Error tipado cuando la BD rechaza una transición de estado en la NC de proveedor
 * (Bug 21). El `hint` viene del `HINT` de la excepción y explica cuál transición se
 * intentó y por qué está bloqueada.
 */
export class NcProveedorTransicionInvalidaError extends Error {
  readonly hint: string;
  constructor(hint: string) {
    super(
      hint ||
        "La nota de crédito no admite ese cambio de estado. Verifica su estado actual antes de continuar.",
    );
    this.name = "NcProveedorTransicionInvalidaError";
    this.hint = hint;
  }
}

function mapEstadoError(err: { message?: string | null } | null | undefined): Error | null {
  if (!err?.message) return null;
  const msg = err.message;
  if (
    msg.includes("LC_NC_PROV_TRANSICION_INVALIDA") ||
    msg.includes("LC_NC_PROV_ESTADO_TERMINAL") ||
    msg.includes("LC_NC_PROV_INSERT_ESTADO_INVALIDO")
  ) {
    const hintMatch = /HINT:\s*([^\n]+)/i.exec(msg);
    return new NcProveedorTransicionInvalidaError((hintMatch?.[1] ?? "").trim());
  }
  return null;
}

export async function fetchNotasCreditoFactura(
  facturaId: string,
): Promise<NotaCreditoProveedor[]> {
  return unwrapOr(
    supabase
      .from("proveedor_notas_credito")
      .select("*")
      .eq("proveedor_factura_id", facturaId)
      .is("deleted_at", null)
      .order("fecha", { ascending: false }),
    [],
  );
}

export async function crearNotaCreditoProveedor(
  payload: TablesInsert<"proveedor_notas_credito">,
): Promise<NotaCreditoProveedor> {
  const { data, error } = await supabase
    .from("proveedor_notas_credito")
    .insert(payload)
    .select()
    .single();
  if (error) {
    const mapped = mapEstadoError(error);
    if (mapped) throw mapped;
    throw error;
  }
  await registrarActividad({
    modulo: "cxp",
    accion: "crear_nota_credito",
    entidadId: data.proveedor_factura_id,
    entidadNombre: data.folio_nc ?? "",
    detalles: { nc_id: data.id, monto: data.monto, moneda: data.moneda },
  });
  return data;
}

/**
 * Aplica una transición de estado y devuelve `true` sólo si el UPDATE afectó
 * una fila real. Con `.select("id").maybeSingle()` detectamos el caso en que
 * el WHERE no encontró nada (estado ya cambió por otra petición, id de otra
 * organización por RLS, o carrera entre pestañas) sin que Supabase lo
 * reporte como error — antes eso se interpretaba como éxito silencioso.
 */
async function updateEstado(
  id: string,
  estado: NotaCreditoProveedor["estado"],
  extra: Partial<NotaCreditoProveedor> = {},
): Promise<boolean> {
  const { data, error } = await supabase
    .from("proveedor_notas_credito")
    .update({ estado, ...extra })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    const mapped = mapEstadoError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return data !== null;
}

export async function aprobarNotaCredito(id: string): Promise<void> {
  const actualizo = await updateEstado(id, "Aprobada", {
    aprobada_at: new Date().toISOString(),
  });
  if (!actualizo) throw conflictoConcurrenciaError();
  await registrarActividad({
    modulo: "cxp",
    accion: "aprobar_nota_credito",
    entidadId: id,
  });
}

export async function aplicarNotaCredito(id: string): Promise<void> {
  // Reintento defensivo: si la NC no se movió al estado terminal aún, la BD bloqueará.
  const actualizo = await updateEstado(id, "Aplicada");
  if (!actualizo) throw conflictoConcurrenciaError();
  await registrarActividad({
    modulo: "cxp",
    accion: "aplicar_nota_credito",
    entidadId: id,
  });
}

export async function cancelarNotaCredito(id: string): Promise<void> {
  const actualizo = await updateEstado(id, "Cancelada");
  if (!actualizo) throw conflictoConcurrenciaError();
  await registrarActividad({
    modulo: "cxp",
    accion: "cancelar_nota_credito",
    entidadId: id,
  });
}
