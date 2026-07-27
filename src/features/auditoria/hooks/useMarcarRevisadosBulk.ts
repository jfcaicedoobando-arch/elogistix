/**
 * Marcar varios hallazgos como revisados en una sola operación.
 * Itera por chunks de 5 con `upsertAuditoriaRevision` (idempotente) y reporta
 * éxitos/fallos parciales.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { useAuth } from "@/lib/contexts/AuthContext";
import { upsertAuditoriaRevision } from "@/features/auditoria/services";
import { insertBitacora } from "@/features/auditoria/services/bitacora";
import { hallazgoHash, AUDITORIA_REVISIONES_KEY } from "@/features/auditoria/hooks/revisiones/hash";
import { queryKeys } from "@/lib/query";
import { logger } from "@/lib/observability/logger";
import { notifyError } from "@/lib/ui/appFeedback";
import type { HallazgoAuditoria } from "@/features/auditoria/types";

const CHUNK = 5;

export interface MarcarRevisadosBulkInput {
  hallazgos: HallazgoAuditoria[];
  accionTomada: string;
}

export interface MarcarRevisadosBulkResult {
  ok: number;
  fail: number;
  errores: { expediente: string; mensaje: string }[];
}

export function useMarcarRevisadosBulk() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();

  return useMutation<MarcarRevisadosBulkResult, Error, MarcarRevisadosBulkInput>({
    mutationFn: async ({ hallazgos, accionTomada }) => {
      if (!user) throw new Error("Usuario no autenticado");
      if (!organizationId) throw new Error("Organización no resuelta");
      const accion = accionTomada.trim();
      if (!accion) throw new Error("La acción tomada es requerida");
      if (hallazgos.length === 0) throw new Error("No hay hallazgos seleccionados");

      const errores: { expediente: string; mensaje: string }[] = [];
      let ok = 0;

      for (let i = 0; i < hallazgos.length; i += CHUNK) {
        const batch = hallazgos.slice(i, i + CHUNK);
        const results = await Promise.allSettled(
          batch.map((h) =>
            upsertAuditoriaRevision({
              organization_id: organizationId,
              embarque_id: h.embarque_id,
              regla: h.regla,
              detalle_hash: hallazgoHash(h),
              detalle: h.detalle,
              accion_tomada: accion,
              revisado_por: user.id,
              revisado_por_email: user.email ?? "",
            }),
          ),
        );
        results.forEach((r, idx) => {
          const h = batch[idx];
          if (r.status === "fulfilled") {
            ok += 1;
            insertBitacora({
              usuarioId: user.id,
              usuarioEmail: user.email ?? "",
              accion: "marcar_hallazgo_revisado",
              modulo: "auditoria",
              entidadId: h.embarque_id,
              entidadNombre: `Hallazgo ${h.regla} — Embarque ${h.expediente}`,
              detalles: {
                regla: h.regla,
                severidad: h.severidad,
                detalle: h.detalle,
                accion_tomada: accion,
                expediente: h.expediente,
                cliente_nombre: h.cliente_nombre,
                bulk: true,
              },
            }).catch((e) => logger.warn("Bitácora bulk falló:", e));
          } else {
            const msg = (r.reason as { message?: string })?.message ?? "Error desconocido";
            errores.push({ expediente: h.expediente, mensaje: msg });
          }
        });
      }

      return { ok, fail: errores.length, errores };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: AUDITORIA_REVISIONES_KEY });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
      if (res.fail === 0) {
        notifySuccess(undefined, { title: `${res.ok} hallazgo${res.ok === 1 ? "" : "s"} marcado${res.ok === 1 ? "" : "s"} como revisado${res.ok === 1 ? "" : "s"}` });
      } else if (res.ok === 0) {
        notifyError(undefined, {
          title: "No se pudo marcar ningún hallazgo",
          description: `${res.fail} con error`,
          method: "FEATURES_AUDITORIA_HOOKS_BULK_REVISADOS_2",
        });
      } else {
        notifyWarning(undefined, { title: `${res.ok} revisado${res.ok === 1 ? "" : "s"}, ${res.fail} con error` });
      }
    },
    onError: (err) => {
      logger.error("[useMarcarRevisadosBulk]", err);
      notifyError(undefined, {
        title: "Error al marcar hallazgos",
        description: err.message,
        method: "FEATURES_AUDITORIA_HOOKS_BULK_REVISADOS_1",
      });
    },
  });
}
