/**
 * useExplicarHallazgo — Llama al servicio `explicarHallazgo` y cachea por hash del hallazgo.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { explicarHallazgo, type ExplicacionHallazgo } from "@/features/auditoria/services/explicarHallazgo";
import type { HallazgoAuditoria } from "@/features/auditoria/types";
import { notifyError } from "@/components/shared/utils/appFeedback";

export type { ExplicacionHallazgo };

function cacheKey(h: HallazgoAuditoria) {
  return ["auditoria-explicacion", h.embarque_id, h.regla, h.detalle] as const;
}

export function useExplicarHallazgo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (h: HallazgoAuditoria): Promise<ExplicacionHallazgo> => {
      const cached = qc.getQueryData<ExplicacionHallazgo>(cacheKey(h));
      if (cached) return cached;
      const data = await explicarHallazgo({
        embarque_id: h.embarque_id,
        regla: h.regla,
        detalle: h.detalle,
      });
      qc.setQueryData(cacheKey(h), data);
      return data;
    },
    onError: (error: Error) => {
      // 13.85.10 — Mapeo de códigos comunes de IA Gateway (402 sin créditos, 429 rate-limit).
      const msg = error.message ?? "";
      const title = msg.includes("402")
        ? "Sin créditos IA disponibles"
        : msg.includes("429")
          ? "Demasiadas solicitudes, intenta en un momento"
          : "No se pudo generar la explicación";
      notifyError(undefined, { title, error, method: "EXPLAIN_HALLAZGO" });
    },
  });
}
