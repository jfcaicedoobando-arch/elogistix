import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { DestinatarioPricing } from "@/features/cotizacion/services/contextoPricingCotizacion";
import { INCOTERMS } from "@/constants/wizardConstants";
import { FRECUENCIAS_COTIZACION } from "@/features/cotizacion/domain/frecuencias";

export function aplicarDestinatarioPricing(form: UseFormReturn<CotizacionFormValues>, destinatario: DestinatarioPricing) {
  const opts = { shouldDirty: true, shouldValidate: true } as const;
  const p = destinatario.prospecto;
  form.setValue("clienteId", destinatario.clienteId, opts);
  form.setValue("esProspecto", Boolean(p), opts);
  form.setValue("oportunidadId", destinatario.oportunidadId, opts);
  form.setValue("leadId", p?.leadId ?? "", opts);
  form.setValue("prospectoEmpresa", p?.empresa ?? "", opts);
  form.setValue("prospectoContacto", p?.contacto ?? "", opts);
  form.setValue("prospectoEmail", p?.email ?? "", opts);
  form.setValue("prospectoTelefono", p?.telefono ?? "", opts);
  const moneda = destinatario.moneda;
  form.setValue("monedaCrm", moneda === "USD" || moneda === "MXN" ? moneda : "", opts);
  const incoterm = INCOTERMS.find((i) => i === p?.icpIncoterm?.trim().toUpperCase());
  if (incoterm) form.setValue("incoterm", incoterm, opts);
  const frecuencia = FRECUENCIAS_COTIZACION.find((f) => f.toLowerCase() === p?.icpFrecuencia?.trim().toLowerCase());
  if (frecuencia) form.setValue("frecuencia", frecuencia, opts);
}
