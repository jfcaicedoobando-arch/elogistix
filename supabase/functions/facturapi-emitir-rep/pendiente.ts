/**
 * P0-A — Timbrado PENDIENTE del REP (CFDI P).
 *
 * Si FacturAPI responde `status: "pending"` (o sin UUID) el REP NO está
 * timbrado: no se marca `estado_rep = "Timbrado"`, no se guarda UUID, no se
 * respalda XML y el claim (`facturapi_rep_id = PENDING:<uuid>`) se conserva.
 * Se registra el id remoto pendiente para que webhook/consulta/recuperación lo
 * promuevan cuando el SAT responda.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import {
  cuerpoPendienteNoPersistido,
  cuerpoTimbradoPendiente,
  esTimbradoPendiente,
  marcarTimbradoPendiente,
} from "../_shared/timbradoPendiente.ts";

interface ArgsPendienteRep {
  supabase: SupabaseClient;
  pagoId: string;
  organizationId: string;
  claimTag: string;
  usuarioId: string;
  usuarioEmail?: string;
  json: (body: unknown, status?: number) => Response;
}

/** 202 si el REP quedó pendiente en FacturAPI; `null` si trae timbre válido. */
export async function respuestaSiRepPendiente(
  invoice: { id?: string | null; uuid?: string | null; status?: string | null } | null,
  args: ArgsPendienteRep,
): Promise<Response | null> {
  if (!esTimbradoPendiente(invoice)) return null;
  return await registrarRepPendiente({ ...args, pendienteId: invoice?.id ?? null });
}

export async function registrarRepPendiente(args: {
  supabase: SupabaseClient;
  pagoId: string;
  organizationId: string;
  claimTag: string;
  pendienteId: string | null;
  usuarioId: string;
  usuarioEmail?: string;
  json: (body: unknown, status?: number) => Response;
}): Promise<Response> {
  const res = await marcarTimbradoPendiente({
    // SAFE-CAST: el cliente implementa el subconjunto tipado que usamos.
    supabase: args.supabase as unknown as Parameters<typeof marcarTimbradoPendiente>[0]["supabase"],
    tabla: "pagos_factura",
    id: args.pagoId,
    claimCol: "facturapi_rep_id",
    claimTag: args.claimTag,
    pendienteIdCol: "facturapi_rep_pendiente_id",
    pendienteAtCol: "facturapi_rep_pendiente_at",
    pendienteId: args.pendienteId,
  });

  await registrarBitacoraEdge(args.supabase, {
    organizationId: args.organizationId,
    usuarioId: args.usuarioId,
    usuarioEmail: args.usuarioEmail,
    modulo: "facturacion",
    accion: res.ok ? "facturapi_rep_emitir_pendiente" : "facturapi_rep_emitir_pendiente_no_persistido",
    entidadId: args.pagoId,
    detalles: {
      facturapi_pendiente_id: args.pendienteId, external_id: args.claimTag,
      persistido: res.ok, error: res.error ?? null,
    },
  });

  // P0 correctivo: sin pendiente persistido no hay rastro para recuperar ⇒ 500.
  if (!res.ok) {
    return args.json(
      cuerpoPendienteNoPersistido({ pendienteId: args.pendienteId, claimTag: args.claimTag, detalle: res.error }),
      500,
    );
  }

  return args.json(
    cuerpoTimbradoPendiente({ pendienteId: args.pendienteId, claimTag: args.claimTag }),
    202,
  );
}
