/**
 * P0-A — Timbrado PENDIENTE de la nota de crédito (CFDI E).
 *
 * Espejo de `facturapi-emitir/pendiente.ts`: si FacturAPI responde
 * `status: "pending"` (o sin UUID), la NC NO pasa a "Timbrada", no se respalda
 * XML y el claim se conserva; sólo se registra el id remoto pendiente.
 */
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import {
  cuerpoPendienteNoPersistido,
  cuerpoTimbradoPendiente,
  esTimbradoPendiente,
  marcarTimbradoPendiente,
  MSG_IDEMPOTENCY_EN_USO,
} from "../_shared/timbradoPendiente.ts";

// SAFE-CAST: cliente de Supabase creado en index.ts.
type Db = ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.45.0").createClient>;

interface Args {
  supabase: Db;
  notaCreditoId: string;
  organizationId: string;
  claimTag: string;
  pendienteId: string | null;
  usuarioId: string;
  usuarioEmail?: string | null;
}

export async function registrarNcPendiente(
  args: Args,
): Promise<{ body: Record<string, unknown>; status: number }> {
  const res = await marcarTimbradoPendiente({
    supabase: args.supabase as unknown as Parameters<typeof marcarTimbradoPendiente>[0]["supabase"],
    tabla: "factura_notas_credito",
    id: args.notaCreditoId,
    claimCol: "facturapi_id",
    claimTag: args.claimTag,
    pendienteIdCol: "facturapi_pendiente_id",
    pendienteAtCol: "facturapi_pendiente_at",
    pendienteId: args.pendienteId,
  });

  await registrarBitacoraEdge(args.supabase, {
    organizationId: args.organizationId,
    usuarioId: args.usuarioId,
    usuarioEmail: args.usuarioEmail ?? undefined,
    modulo: "facturacion",
    accion: res.ok ? "facturapi_nc_emitir_pendiente" : "facturapi_nc_emitir_pendiente_no_persistido",
    entidadId: args.notaCreditoId,
    detalles: {
      facturapi_pendiente_id: args.pendienteId, external_id: args.claimTag,
      persistido: res.ok, error: res.error ?? null,
    },
  });

  // P0 correctivo: sin pendiente persistido no hay rastro para recuperar ⇒ 500.
  if (!res.ok) {
    return {
      body: cuerpoPendienteNoPersistido({ pendienteId: args.pendienteId, claimTag: args.claimTag, detalle: res.error }),
      status: 500,
    };
  }

  return {
    body: cuerpoTimbradoPendiente({ pendienteId: args.pendienteId, claimTag: args.claimTag }),
    status: 202,
  };
}

/**
 * Devuelve la respuesta 202 si el CFDI quedó pendiente en FacturAPI, o `null`
 * si trae timbre válido y el flujo normal debe continuar.
 */
export async function respuestaSiNcPendiente(
  invoice: { id?: string | null; uuid?: string | null; status?: string | null } | null,
  args: Omit<Args, "pendienteId">,
): Promise<{ body: Record<string, unknown>; status: number } | null> {
  if (!esTimbradoPendiente(invoice)) return null;
  return await registrarNcPendiente({ ...args, pendienteId: invoice?.id ?? null });
}

/** P0-B.4 — llave de idempotencia en uso: reconciliar, nunca crear otra NC. */
export function cuerpoIdempotencyEnUsoNc(claimTag: string): { body: Record<string, unknown>; status: number } {
  return {
    body: {
      error: "idempotency_key_in_use",
      reintentable: false,
      external_id: claimTag,
      message: MSG_IDEMPOTENCY_EN_USO,
    },
    status: 409,
  };
}
