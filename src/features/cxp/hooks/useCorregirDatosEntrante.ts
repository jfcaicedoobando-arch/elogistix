/**
 * v13.508.0 — Mutaciones para corregir los datos declarados de un documento
 * del buzón CxP (proveedor, monto, nota y conceptos sugeridos).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { cxp } from "@/features/cxp/queryKeys";
import {
  actualizarDatosEntrante,
  reemplazarConceptosEntrante,
  type ConceptoSugeridoEntranteInput,
  type DatosEntranteEditables,
} from "@/features/cxp/services/facturasEntrantesEditar";

export interface CorregirEntranteInput extends DatosEntranteEditables {
  id: string;
  nombreArchivo?: string | null;
  conceptos: readonly ConceptoSugeridoEntranteInput[];
}

export function useCorregirDatosEntrante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nombreArchivo, conceptos, ...datos }: CorregirEntranteInput) => {
      await actualizarDatosEntrante(id, datos, nombreArchivo);
      await reemplazarConceptosEntrante(id, conceptos, nombreArchivo);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cxp.facturasEntrantes });
      notifySuccess(undefined, {
        title: "Datos del documento corregidos",
        description: "Contabilidad verá los datos actualizados en el buzón.",
      });
    },
    onError: (error) => notifyError(undefined, {
      title: "No se pudieron corregir los datos",
      error,
      method: "CORREGIR_DATOS_ENTRANTE",
    }),
  });
}
