import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  insertCotizacionDesdeOportunidad,
  actualizarEtapaOportunidad,
  type CrearCotizacionDesdeOpInput,
} from "@/features/crm/services";
import { generarFolioCotizacion } from "@/features/cotizacion/services/queries";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

interface UseCrearCotizacionDesdeOpInput {
  oportunidad: CrearCotizacionDesdeOpInput["oportunidad"] & {
    etapa_id: string;
    modo: string;
  };
  etapaCotizandoId?: string;
  etapaCotizandoProbabilidad?: number;
}

const MODO_MAP: Record<string, "Marítimo" | "Aéreo" | "Terrestre" | "Multimodal"> = {
  "Marítimo": "Marítimo",
  "Aéreo": "Aéreo",
  "Terrestre": "Terrestre",
  "Multimodal": "Multimodal",
};

export function useCrearCotizacionDesdeOportunidad() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: UseCrearCotizacionDesdeOpInput) => {
      const folio = await generarFolioCotizacion();
      const modo = MODO_MAP[input.oportunidad.modo] ?? "Marítimo";
      const cot = await insertCotizacionDesdeOportunidad({
        folio,
        modo,
        oportunidad: input.oportunidad,
        operador: user?.email ?? "",
      });
      if (
        input.etapaCotizandoId &&
        input.oportunidad.etapa_id !== input.etapaCotizandoId
      ) {
        await actualizarEtapaOportunidad(
          input.oportunidad.id,
          input.etapaCotizandoId,
          input.etapaCotizandoProbabilidad ?? 0,
        );
      }
      return { id: cot.id, folio };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.opCotizaciones.all });
      notifySuccess(undefined, { title: `Cotización ${data.folio} creada` });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear cotización desde oportunidad: ${error.message}`, error, method: "CREATE_COTIZACION_FROM_OP" });
    },
  });
}
