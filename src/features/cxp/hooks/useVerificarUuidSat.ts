import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import {
  verificarUuidSat,
  type EstatusSat,
  type VerificarUuidResult,
} from "@/features/cxp/services/verificarUuidSat";
import { notifyError } from "@/lib/ui/appFeedback";
import { notificarNoVerificable } from "./satNoVerificable";
import { queryKeys } from "@/lib/query";

const METHOD = "FEATURES_CXP_HOOKS_USEVERIFICARUUIDSAT";

/**
 * v13.320.62 — el SAT devuelve un `raw` con el código y la leyenda oficial
 * (ej. `N - 601 | La expresión impresa proporcionada no es válida`). Antes lo
 * descartábamos y el usuario sólo veía "SAT no devolvió un estatus válido",
 * sin pista de qué corregir.
 */
function descripcionSat(raw?: string): string | undefined {
  const t = raw?.trim();
  if (!t || t === "|") return undefined;
  return `Respuesta del SAT: ${t}`;
}

/**
 * Hook para verificar el UUID de una factura de proveedor contra el SAT.
 * Refresca la lista de CxP al terminar.
 * v13.187.0
 */
export function useVerificarUuidSat() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.cxp.all,
    mutationFn: (facturaId: string) => verificarUuidSat(facturaId),
    onSuccess: (res: VerificarUuidResult) => {
      const detalle = descripcionSat(res.raw);
      const estatus: EstatusSat = res.estatus;
      if (estatus === "Vigente") notifySuccess(undefined, { title: "CFDI Vigente en SAT" });
      else if (estatus === "Cancelado")
        notifyWarning(undefined, { title: "CFDI Cancelado en SAT", description: detalle });
      else if (estatus === "No verificable") notificarNoVerificable(detalle);
      else if (estatus === "No Encontrado")
        notifyError(undefined, {
          title: "CFDI No encontrado en SAT",
          description: detalle,
          method: METHOD,
        });
      else
        notifyError(undefined, {
          title: "SAT no devolvió un estatus válido",
          description:
            detalle ??
            "El SAT no devolvió un estatus reconocible. Revisa que el RFC del proveedor, el UUID y el total coincidan con el CFDI.",
          method: METHOD,
        });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.proveedorFacturas.all });
    },
    onError: (err: Error) =>
      notifyError(undefined, {
        title: `No se pudo consultar SAT: ${err.message}`,
        error: err,
        method: METHOD,
      }),
  });
}
