/**
 * P3 (v13.297.0) — Hooks para Duplicar cotización y Versiones (snapshots).
 *
 * `useDuplicarCotizacion` invoca la RPC `duplicar_cotizacion(uuid)` que crea
 * una copia en estado Borrador con folio nuevo y devuelve el UUID de la nueva
 * cotización.
 *
 * `useVersionesCotizacion` lee la cronología de snapshots inmutables generados
 * cuando la cotización pasa a 'Enviada'.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query";

export interface CotizacionVersionRow {
  id: string;
  cotizacion_id: string;
  organization_id: string;
  version_num: number;
  folio: string;
  estado_al_snapshot: string;
  snapshot: Record<string, unknown>;
  costos_snapshot: Array<Record<string, unknown>>;
  created_by: string | null;
  created_at: string;
}

export function useDuplicarCotizacion() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: async (cotizacionId: string) => {
      // SAFE-CAST: la RPC está registrada en la base pero puede no estar en
      // los tipos generados hasta el próximo build. Casteamos el nombre.
      const { data, error } = await supabase.rpc(
        "duplicar_cotizacion" as never,
        { p_id: cotizacionId } as never,
      );
      if (error) throw new Error(error.message);
      return data as unknown as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      toast.success("Cotización duplicada. Se abrió el borrador nuevo.");
    },
    onError: (e) => toast.error(e.message || "No se pudo duplicar la cotización"),
  });
}

export function useVersionesCotizacion(cotizacionId: string | null | undefined) {
  return useQuery<CotizacionVersionRow[]>({
    queryKey: queryKeys.cotizaciones.versiones(cotizacionId ?? "none"),
    enabled: !!cotizacionId,
    queryFn: async () => {
      const { data, error } = await supabase
        // SAFE-CAST: tabla nueva; tipos aún no incluidos hasta regeneración.
        .from("cotizacion_versiones" as never)
        .select(
          "id, cotizacion_id, organization_id, version_num, folio, estado_al_snapshot, snapshot, costos_snapshot, created_by, created_at",
        )
        .eq("cotizacion_id", cotizacionId as string)
        .order("version_num", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as CotizacionVersionRow[];
    },
  });
}
