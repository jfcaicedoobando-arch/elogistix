import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";
import { mapearSolicitudACotizacion } from "@/features/cotizacion/domain/mapeoSolicitudCotizacion";
import { aplicarTarifaAlForm } from "./aplicarTarifaAlForm";

import type { MetadataRespuestaPricing } from "@/features/cotizacion/domain/respuestaPricing";
import { cantidadContenedoresPricing, validarIncotermRespuestaPricing } from "@/features/cotizacion/domain/respuestaPricing";

export function aplicarRespuestaPricing(form: UseFormReturn<CotizacionFormValues>, tarifa: TopTarifaRow, metadata?: MetadataRespuestaPricing | null) {
  const incoterm = validarIncotermRespuestaPricing(metadata);
  const opts = { shouldDirty: true, shouldValidate: true } as const;
  if (metadata) {
    if (incoterm) form.setValue("incoterm", incoterm, opts);
    const cantidad = cantidadContenedoresPricing(metadata, tarifa, form.getValues("tipoEmbarque"));
    if (cantidad != null) form.setValue("numContenedores", cantidad, opts);
    const mapeo = mapearSolicitudACotizacion(metadata);
    // Sólo llena lo vacío: nunca pisa lo que el usuario ya capturó.
    for (const [campo, valor] of Object.entries(mapeo) as Array<[keyof typeof mapeo, string | number]>) {
      const actual = form.getValues(campo);
      if (actual === "" || actual == null || actual === 0) form.setValue(campo, valor as never, opts);
    }
  }
  form.setValue("modo", "Marítimo", opts);
  // El autosync del Paso 2 es la única vía de generación de costos.
  aplicarTarifaAlForm(form.setValue, form.trigger, tarifa, form.getValues("validezPropuesta"));
}
