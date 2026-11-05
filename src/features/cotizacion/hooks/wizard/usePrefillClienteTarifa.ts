/**
 * "Cotizar y guardar tarifa": tras aplicar la tarifa, fija el cliente especial
 * elegido en el tarifario, sólo si la cotización aún no tiene destinatario.
 */
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

export function usePrefillClienteTarifa(
  form: UseFormReturn<CotizacionFormValues>,
  clienteId: string | null,
  prefillAplicado: boolean,
) {
  const hecho = useRef(false);
  useEffect(() => {
    if (!clienteId || !prefillAplicado || hecho.current) return;
    hecho.current = true;
    const v = form.getValues();
    if (v.clienteId || v.esProspecto) return;
    form.setValue("clienteId", clienteId, { shouldDirty: true, shouldValidate: true });
    void form.trigger("clienteId");
  }, [form, clienteId, prefillAplicado]);
}
