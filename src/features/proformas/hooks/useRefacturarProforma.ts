import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { facturaCanceladaDeProforma, refacturarProforma } from "../services/refacturar";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

export function useFacturaCanceladaDeProforma(proformaId: string, habilitada: boolean) {
  return useQuery({
    queryKey: queryKeys.proformas.facturaCancelada(proformaId),
    queryFn: () => facturaCanceladaDeProforma(proformaId),
    enabled: habilitada,
  });
}

export function useRefacturarProforma(proformaId: string, onSuccess: () => void) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => refacturarProforma(proformaId),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: queryKeys.proformas.all });
      notifySuccess(undefined, {
        title: `Se creó la proforma ${r.nuevo_numero}`,
        description: `${r.anterior_numero} quedó cancelada como historial.`,
      });
      onSuccess();
      navigate(`/proformas/${r.nueva_proforma_id}`);
    },
    onError: (err: unknown) => {
      notifyError(undefined, {
        title: "No se pudo refacturar la proforma",
        description: getErrorMessage(err),
        error: err,
        method: "REFACTURAR_PROFORMA",
      });
    },
  });

}
