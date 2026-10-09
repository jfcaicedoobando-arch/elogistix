/**
 * Precarga en una cotización nueva la tarifa elegida en una solicitud de
 * Pricing (`?tarifa=`). Si también llega `?oportunidad=`, espera a que la
 * empresa de la oportunidad quede cargada para no pisarse con ese prefill.
 */
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import { fetchTarifaVigentePorId } from "@/features/costeo/services/topTarifas";
import { aplicarTarifaAlForm } from "@/features/cotizacion/components/seccionRuta/aplicarTarifa";
import { cotizaciones } from "@/features/cotizacion/queryKeys";
import { notifyError } from "@/lib/ui/appFeedback";

interface Deps {
  form: UseFormReturn<CotizacionFormValues>;
  tarifaId: string | null;
  esperarOportunidad: boolean;
  enabled: boolean;
}

export function usePrefillTarifaPricing({ form, tarifaId, esperarOportunidad, enabled }: Deps) {
  const aplicado = useRef(false);
  const { data: row, isFetched } = useQuery({
    queryKey: cotizaciones.prefillTarifaPricing(tarifaId),
    queryFn: () => fetchTarifaVigentePorId(tarifaId ?? ""),
    enabled: enabled && Boolean(tarifaId),
  });
  const oportunidadId = form.watch("oportunidadId");

  useEffect(() => {
    if (!enabled || aplicado.current || !isFetched) return;
    if (esperarOportunidad && !oportunidadId) return;
    aplicado.current = true;
    if (!row) {
      notifyError(undefined, { title: "La tarifa de Pricing ya no está vigente; elige otra en la ruta.", method: "COTIZACION_PREFILL_TARIFA_PRICING" });
      return;
    }
    if (form.getValues("tarifaId")) return;
    form.setValue("modo", "Marítimo", { shouldDirty: true, shouldValidate: true });
    aplicarTarifaAlForm(form.setValue, form.trigger, row);
  }, [enabled, isFetched, row, esperarOportunidad, oportunidadId, form]);
}
