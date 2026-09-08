/**
 * CRM-COT-01 — precarga del destinatario cuando se llega al wizard desde una
 * oportunidad de prospecto (`/cotizaciones/nueva?oportunidad=<id>`).
 *
 * No inserta nada: sólo rellena el paso 1 con el mismo vínculo que produce el
 * buscador de prospectos (oportunidad + lead + datos reales del destinatario +
 * moneda del CRM, sin convertir importes). Si ya hay un borrador vivo o el
 * usuario capturó algo, NO se pisa nada.
 */
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types/form";
import { useCrmProspectoOportunidad } from "@/features/crm/hooks/useCrmProspectoOportunidad";

interface Deps {
  form: UseFormReturn<CotizacionFormValues>;
  oportunidadId: string | null;
  /** Falso mientras haya borrador pendiente/restauración o cotización creada. */
  enabled: boolean;
}

export function usePrefillProspectoOportunidad({ form, oportunidadId, enabled }: Deps) {
  const aplicado = useRef(false);
  const { data: match } = useCrmProspectoOportunidad(oportunidadId, enabled);

  useEffect(() => {
    if (!enabled || aplicado.current || !match) return;
    // Nunca reemplazamos un vínculo o destinatario ya capturado por el usuario.
    const v = form.getValues();
    if (v.oportunidadId || v.leadId || v.clienteId) {
      aplicado.current = true;
      return;
    }
    const opts = { shouldDirty: true, shouldValidate: true } as const;
    form.setValue("esProspecto", true, opts);
    form.setValue("oportunidadId", match.id, opts);
    form.setValue("leadId", match.leadId ?? "", { shouldDirty: true });
    form.setValue("prospectoEmpresa", match.empresa, { shouldDirty: true });
    form.setValue("prospectoContacto", match.contacto, { shouldDirty: true });
    form.setValue("prospectoEmail", match.email, { shouldDirty: true });
    form.setValue("prospectoTelefono", match.telefono, { shouldDirty: true });
    const moneda = match.moneda === "USD" || match.moneda === "MXN" ? match.moneda : "";
    // La moneda del vínculo viaja en `monedaCrm` (el guardado la usa tal cual,
    // sin convertir importes).
    form.setValue("monedaCrm", moneda, { shouldDirty: true });
    form.trigger(["oportunidadId", "prospectoEmpresa"]);
    aplicado.current = true;
  }, [enabled, match, form]);
}
