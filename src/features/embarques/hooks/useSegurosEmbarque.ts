import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  createSeguroEmbarque,
  deleteSeguroEmbarque,
  fetchSegurosEmbarque,
  updateSeguroEmbarque,
  type SeguroEmbarque,
  type SeguroEmbarqueInput,
} from "@/features/embarques/services/seguros";
import { queryKeys } from "@/lib/query";

const KEY = queryKeys.embarques.seguros;

/** Traduce los rechazos del vínculo póliza ↔ factura (hallazgo 148). */
function mensajeSeguro(e: Error, fallback: string): string {
  const m = e?.message ?? "";
  if (m.includes("ux_seguros_embarque_factura_activa")) return "Esa factura ya está ligada a otra póliza activa.";
  if (m.includes("LC_SEGURO_COBERTURA_INCOMPLETA")) return "La base de la factura atribuida a este embarque debe cubrir toda la prima y tener una valoración comprobable. Revisa la factura, la prima y la moneda.";
  if (m.includes("LC_CONFLICTO_CONCURRENCIA")) return "La factura o el embarque cambió mientras guardabas. Recarga y revisa los datos antes de volver a guardar.";
  if (m.includes("LC_SEGURO_FACTURA_INVALIDA")) return "La factura no está vigente o no pertenece a este embarque.";
  return m || fallback;
}

export function useSegurosEmbarque(embarqueId: string | undefined) {
  return useQuery<SeguroEmbarque[]>({
    queryKey: KEY(embarqueId),
    queryFn: () => fetchSegurosEmbarque(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
}

function invalidatePnl(qc: ReturnType<typeof useQueryClient>, embarqueId?: string) {
  qc.invalidateQueries({ queryKey: KEY(embarqueId) });
  qc.invalidateQueries({ queryKey: queryKeys.embarques.pnlFinanciero(embarqueId) });
  qc.invalidateQueries({ queryKey: queryKeys.embarques.segurosFacturasElegibles(embarqueId) });
}

export function useCreateSeguro(embarqueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SeguroEmbarqueInput) => createSeguroEmbarque(input),
    onSuccess: () => {
      invalidatePnl(qc, embarqueId);
      notifySuccess(undefined, { title: "Póliza registrada" });
    },
    onError: (e: Error) => notifyError(undefined, { title: mensajeSeguro(e, "No se pudo guardar la póliza"), error: e, method: "FEATURES_EMBARQUES_HOOKS_USESEGUROSEMBARQUE_1" }),
  });
}

export function useUpdateSeguro(embarqueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Partial<SeguroEmbarqueInput> }) =>
      updateSeguroEmbarque(vars.id, vars.patch),
    onSuccess: () => {
      invalidatePnl(qc, embarqueId);
      notifySuccess(undefined, { title: "Póliza actualizada" });
    },
    onError: (e: Error) => notifyError(undefined, { title: mensajeSeguro(e, "No se pudo actualizar la póliza"), error: e, method: "FEATURES_EMBARQUES_HOOKS_USESEGUROSEMBARQUE_2" }),
  });
}

export function useDeleteSeguro(embarqueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSeguroEmbarque(id),
    onSuccess: () => {
      invalidatePnl(qc, embarqueId);
      notifySuccess(undefined, { title: "Póliza eliminada" });
    },
    onError: (e: Error) => notifyError(undefined, { title: mensajeSeguro(e, "No se pudo eliminar la póliza"), error: e, method: "FEATURES_EMBARQUES_HOOKS_USESEGUROSEMBARQUE_3" }),
  });
}
