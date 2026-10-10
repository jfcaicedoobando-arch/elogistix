import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";
import { aplicarTarifaAlForm } from "@/features/cotizacion/components/seccionRuta/aplicarTarifa";

import type { MetadataRespuestaPricing } from "@/features/cotizacion/domain/respuestaPricing";
import { cantidadContenedoresPricing, validarIncotermRespuestaPricing } from "@/features/cotizacion/domain/respuestaPricing";

export function aplicarRespuestaPricing(form: UseFormReturn<CotizacionFormValues>, tarifa: TopTarifaRow, metadata?: MetadataRespuestaPricing | null) {
  const incoterm = validarIncotermRespuestaPricing(metadata);
  const opts = { shouldDirty: true, shouldValidate: true } as const;
  if (metadata) {
    if (incoterm) form.setValue("incoterm", incoterm, opts);
    const cantidad = cantidadContenedoresPricing(metadata, tarifa, form.getValues("tipoEmbarque"));
    if (cantidad != null) form.setValue("numContenedores", cantidad, opts);
  }
  form.setValue("modo", "Marítimo", opts);
  // El autosync del Paso 2 es la única vía de generación de costos.
  aplicarTarifaAlForm(form.setValue, form.trigger, tarifa, {}, form.getValues("validezPropuesta"));
}
