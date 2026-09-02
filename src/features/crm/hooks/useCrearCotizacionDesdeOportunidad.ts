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
import { getErrorMessage } from "@/lib/errors";

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
      // v13.823.32: la cotización YA quedó creada. Si mover la etapa falla no
      // podemos anunciar fracaso (el reintento generaba duplicados): avisamos
      // aparte y devolvemos la cotización.
      let avisoEtapa: string | null = null;
      if (
        input.etapaCotizandoId &&
        input.oportunidad.etapa_id !== input.etapaCotizandoId
      ) {
        try {
          await actualizarEtapaOportunidad(
            input.oportunidad.id,
            input.etapaCotizandoId,
            input.etapaCotizandoProbabilidad ?? 0,
          );
        } catch (err) {
          avisoEtapa = getErrorMessage(err);
        }
      }
      return { id: cot.id, folio: cot.folio, reutilizada: cot.reutilizada, avisoEtapa };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.opCotizaciones.all });
      notifySuccess(undefined, {
        title: data.reutilizada
          ? `Continuamos con la cotización ${data.folio}`
          : `Cotización ${data.folio} creada`,
        description: data.avisoEtapa
          ? `La etapa de la oportunidad no se pudo actualizar: ${data.avisoEtapa}. Muévela manualmente.`
          : undefined,
      });
    },

    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo crear cotización desde oportunidad", description: getErrorMessage(error), error, method: "CREATE_COTIZACION_FROM_OP" });
    },
  });
}
