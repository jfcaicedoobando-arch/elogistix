/**
 * useExplicarHallazgo — Llama a la edge function `auditoria-explicar-hallazgo`
 * y cachea por hash del hallazgo.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HallazgoAuditoria } from "@/features/auditoria/types";

export interface ExplicacionHallazgo {
  explicacion: string;
  modelo: string;
}

function cacheKey(h: HallazgoAuditoria) {
  return ["auditoria-explicacion", h.embarque_id, h.regla, h.detalle] as const;
}

export function useExplicarHallazgo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (h: HallazgoAuditoria): Promise<ExplicacionHallazgo> => {
      const cached = qc.getQueryData<ExplicacionHallazgo>(cacheKey(h));
      if (cached) return cached;
      const { data, error } = await supabase.functions.invoke<ExplicacionHallazgo>(
        "auditoria-explicar-hallazgo",
        { body: { embarque_id: h.embarque_id, regla: h.regla, detalle: h.detalle } },
      );
      if (error) throw error;
      if (!data?.explicacion) throw new Error("Respuesta vacía");
      qc.setQueryData(cacheKey(h), data);
      return data;
    },
  });
}

export function getExplicacionCached(qc: ReturnType<typeof useQueryClient>, h: HallazgoAuditoria) {
  return qc.getQueryData<ExplicacionHallazgo>(cacheKey(h));
}
