import { useCallback, useState } from "react";
import type { CotizacionInitialCosto } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import type { StepMutations } from "./wizardStepsTypes";

type Mutation = StepMutations["upsertCostos"];
function origenesDe(costos: { origen_venta_id?: string | null }[]): Set<string> {
  return new Set(costos.flatMap(c => c.origen_venta_id ? [c.origen_venta_id] : []));
}

/** Un UUID hidratado en memoria no confirma que el costo ya lo tenga guardado. */
export function useCostosOrigenConfirmado(mutation: Mutation, initialCostos: CotizacionInitialCosto[] = []) {
  const [origenes, setOrigenes] = useState(() => origenesDe(initialCostos));
  const mutateAsync = useCallback<Mutation["mutateAsync"]>(async vars => {
    const resultado = await mutation.mutateAsync(vars);
    // Sólo la respuesta de nuestra escritura confirma estos vínculos; nunca un readback.
    if (resultado.updatedAt) setOrigenes(origenesDe(vars.costos));
    return resultado;
  }, [mutation]);
  return { origenes, mutation: { ...mutation, mutateAsync } };
}
