/**
 * P0-A — Timbrado PENDIENTE de la factura (CFDI I).
 *
 * FacturAPI puede responder 2xx con `status: "pending"` sin UUID. En ese caso
 * NO se persiste "Emitida", ni UUID, ni respaldo XML, y el claim se conserva:
 * sólo se registra el id remoto pendiente para que webhook/consulta/
 * recuperación puedan promoverlo cuando el SAT responda.
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import {
  cuerpoPendienteNoPersistido,
  cuerpoTimbradoPendiente,
  marcarTimbradoPendiente,
  MSG_IDEMPOTENCY_EN_USO,
} from "../_shared/timbradoPendiente.ts";

interface Args {
  supabase: SupabaseClient;
  facturaId: string;
  organizationId: string;
  numero: string | null;
  claimTag: string;
  pendienteId: string | null;
  usuarioId: string;
  usuarioEmail?: string | null;
}

export async function registrarFacturaPendiente(args: Args): Promise<Response> {
  const res = await marcarTimbradoPendiente({
    // SAFE-CAST: el cliente de Supabase implementa el subconjunto tipado.
    supabase: args.supabase as unknown as Parameters<typeof marcarTimbradoPendiente>[0]["supabase"],
    tabla: "facturas",
    id: args.facturaId,
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
    accion: res.ok ? "facturapi_emitir_pendiente" : "facturapi_emitir_pendiente_no_persistido",
    entidadId: args.facturaId,
    entidadNombre: args.numero ?? "",
    detalles: {
      facturapi_pendiente_id: args.pendienteId, external_id: args.claimTag,
      persistido: res.ok, error: res.error ?? null,
    },
  });

  // P0 correctivo: sin pendiente persistido no hay rastro para recuperar ⇒ 500.
  if (!res.ok) {
    return jsonResponse(
      cuerpoPendienteNoPersistido({ pendienteId: args.pendienteId, claimTag: args.claimTag, detalle: res.error }),
      500,
    );
  }

  return jsonResponse(
    cuerpoTimbradoPendiente({ pendienteId: args.pendienteId, claimTag: args.claimTag }),
    202,
  );
}

/**
 * P0-B.4 — `idempotency_key_in_use`: NO se libera el claim ni se permite crear
 * otro CFDI; el usuario reconcilia con 'Recuperar timbrado'.
 */
export async function respuestaIdempotencyEnUso(args: Omit<Args, "pendienteId">): Promise<Response> {
  await registrarBitacoraEdge(args.supabase, {
    organizationId: args.organizationId,
    usuarioId: args.usuarioId,
    usuarioEmail: args.usuarioEmail ?? undefined,
    modulo: "facturacion",
    accion: "facturapi_emitir_idempotency_en_uso",
    entidadId: args.facturaId,
    entidadNombre: args.numero ?? "",
    detalles: { external_id: args.claimTag },
  });
  return jsonResponse({
    error: "idempotency_key_in_use",
    reintentable: false,
    external_id: args.claimTag,
    message: MSG_IDEMPOTENCY_EN_USO,
  }, 409);
}
