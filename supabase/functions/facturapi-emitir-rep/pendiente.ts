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
import { cuerpoTimbradoPendiente, marcarTimbradoPendiente } from "../_shared/timbradoPendiente.ts";

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
    accion: "facturapi_rep_emitir_pendiente",
    entidadId: args.pagoId,
    detalles: { facturapi_pendiente_id: args.pendienteId, external_id: args.claimTag, persistido: res.ok },
  });

  return args.json(
    cuerpoTimbradoPendiente({ pendienteId: args.pendienteId, claimTag: args.claimTag }),
    202,
  );
}
