import { supabase } from "@/integrations/supabase/client";
import type { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { ReglaNegocioError } from "@/lib/errors/reglaNegocio";

export interface DatosEventoTracking {
  embarqueId: string;
  accion: "eta" | "llegada";
  fecha: string;
  ubicacion: string;
}

export class DocumentosTrackingPendientesError extends ReglaNegocioError {}

export async function registrarEventoTracking({
  scope, ...input
}: DatosEventoTracking & { requestId: string; scope: ReturnType<typeof captureAuthOperationScope> }): Promise<void> {
  scope.assertCurrent();
  // SAFE-CAST: firma de la migración 0050, pendiente en los tipos de Supabase generados.
  const { data, error } = await supabase.rpc("registrar_evento_tracking_embarque" as never, {
    p_embarque_id: input.embarqueId,
    p_request_id: input.requestId,
    p_accion: input.accion,
    p_fecha: input.fecha,
    p_ubicacion: input.ubicacion,
    p_organization_id: scope.organizationId,
  } as never);
  scope.assertCurrent();
  if (error) {
    const prefijo = "LC_TRACKING_DOCS_PENDIENTES: ";
    if (error.message.startsWith(prefijo)) {
      throw new DocumentosTrackingPendientesError(error.message.slice(prefijo.length));
    }
    if (error.code === "23514") throw new ReglaNegocioError(error.message);
    throw error;
  }
  if (data !== input.requestId) throw new Error("El servidor no confirmó el registro de tracking.");
}
