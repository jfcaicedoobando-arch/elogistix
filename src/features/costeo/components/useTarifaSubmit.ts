/**
 * Hook que encapsula la lógica de submit del modal de tarifa marítima.
 * Los toasts viven en `useCosteoTarifaMutations` (convención: notificaciones
 * en el hook de mutación, no en componentes — ver
 * `architecture/no-double-toast-on-mutate.test.ts`).
 * Extraído de `TarifaForm.tsx` para mantener su complejidad ciclomática ≤16.
 */
import { useCallback } from "react";
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
      { onSuccess: () => onSuccess() },
    );
  }, [actualizar, tarifaId, form, onSuccess]);

  const submitUno = useCallback(() => {
    const input: TarifaInput = { ...form, ruta_id: rutaIds[0] ?? form.ruta_id };
    crear.mutate(input, { onSuccess: () => onSuccess() });
  }, [crear, form, rutaIds, onSuccess]);

  const submitMultiple = useCallback(() => {
    const inputs: TarifaInput[] = rutaIds.map((ruta_id) => ({ ...form, ruta_id }));
    crearMultiples.mutate(inputs, {
      onSuccess: ({ exitos, fallos }) => {
        if (fallos.length === 0) {
          onSuccess();
          return;
        }
        onPartialSuccess(new Set(exitos.map((i) => i.ruta_id)));
      },
    });
  }, [crearMultiples, form, rutaIds, onSuccess, onPartialSuccess]);

  return useCallback(() => {
    if (esEdicion) return submitEdicion();
    if (rutaIds.length <= 1) return submitUno();
    return submitMultiple();
  }, [esEdicion, rutaIds.length, submitEdicion, submitUno, submitMultiple]);
}
