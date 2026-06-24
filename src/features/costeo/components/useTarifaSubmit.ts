/**
 * Hook que encapsula la lógica de submit del modal de tarifa marítima.
 * Extraído de `TarifaForm.tsx` para mantener su complejidad ciclomática ≤16.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import { notifyError } from "@/components/shared/utils/appFeedback";
import type { useCosteoTarifaMutations } from "@/features/costeo/hooks/useCosteoTarifas";
import type { TarifaInput } from "@/features/costeo/services/tarifas";

type Mutations = ReturnType<typeof useCosteoTarifaMutations>;

interface Params {
  mutations: Mutations;
  form: TarifaInput;
  rutaIds: string[];
  esEdicion: boolean;
  tarifaId?: string;
  onSuccess: () => void;
  onPartialSuccess: (idsCreados: Set<string>) => void;
}

export function useTarifaSubmit({
  mutations, form, rutaIds, esEdicion, tarifaId, onSuccess, onPartialSuccess,
}: Params) {
  const { crear, crearMultiples, actualizar } = mutations;

  const submitEdicion = useCallback(() => {
    if (!tarifaId) return;
    actualizar.mutate(
      { id: tarifaId, input: form },
      {
        onSuccess: () => { toast.success("Tarifa actualizada"); onSuccess(); },
        onError: (err: Error) =>
          notifyError(undefined, { title: "No se pudo actualizar la tarifa", description: err.message, error: err, method: "FEATURES_COSTEO_COMPONENTS_USETARIFASUBMIT_1" }),
      },
    );
  }, [actualizar, tarifaId, form, onSuccess]);

  const submitUno = useCallback(() => {
    const input: TarifaInput = { ...form, ruta_id: rutaIds[0] ?? form.ruta_id };
    crear.mutate(input, {
      onSuccess: () => { toast.success("Tarifa creada"); onSuccess(); },
      onError: (err: Error) =>
        notifyError(undefined, { title: "No se pudo crear la tarifa", description: err.message, error: err, method: "FEATURES_COSTEO_COMPONENTS_USETARIFASUBMIT_2" }),
    });
  }, [crear, form, rutaIds, onSuccess]);

  const submitMultiple = useCallback(() => {
    const inputs: TarifaInput[] = rutaIds.map((ruta_id) => ({ ...form, ruta_id }));
    crearMultiples.mutate(inputs, {
      onSuccess: ({ exitos, fallos }) => {
        if (fallos.length === 0) {
          toast.success(`Se crearon ${exitos.length} tarifa${exitos.length === 1 ? "" : "s"}`);
          onSuccess();
          return;
        }
        toast.warning(`Se crearon ${exitos.length} de ${exitos.length + fallos.length} tarifas`, {
          description: `Quedan ${fallos.length} con error; revisa las rutas restantes.`,
        });
        onPartialSuccess(new Set(exitos.map((i) => i.ruta_id)));
      },
      onError: (err: Error) =>
        notifyError(undefined, { title: "No se pudieron crear las tarifas", description: err.message, error: err, method: "FEATURES_COSTEO_COMPONENTS_USETARIFASUBMIT_3" }),
    });
  }, [crearMultiples, form, rutaIds, onSuccess, onPartialSuccess]);

  return useCallback(() => {
    if (esEdicion) return submitEdicion();
    if (rutaIds.length <= 1) return submitUno();
    return submitMultiple();
  }, [esEdicion, rutaIds.length, submitEdicion, submitUno, submitMultiple]);
}
