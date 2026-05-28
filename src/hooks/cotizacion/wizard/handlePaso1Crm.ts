/**
 * Helpers para el paso 1 del wizard de cotización:
 * - Validación de los campos de destinatario (cliente vs prospecto).
 * - Vinculación CRM (lead/oportunidad) tras crear la cotización nueva.
 *
 * Extraído de `useCotizacionWizardSteps` en 12.1.0 para cumplir Power of 10.
 */
import { supabase } from "@/integrations/supabase/client";
import { vincularOCrearOportunidadParaCotizacion } from "@/services/crm/vincularCotizacion";
import { getErrorMessage } from "@/lib/errors";
import { notifyError } from "@/lib/ui/appFeedback";
import type { CotizacionFormValues } from "@/lib/mappers/cotizacionForm";

interface ToastFn {
  (opts: { title: string; description?: string; variant?: "destructive" | "default" }): void;
}

export function validatePaso1(v: CotizacionFormValues): string | null {
  if (!v.esProspecto && !v.clienteId) return "Selecciona un cliente";
  if (v.esProspecto) {
    if (v.prospectoModo === "vincular" && !v.oportunidadId && !v.leadId) {
      return "Selecciona un lead u oportunidad existente, o cambia a 'Crear nuevo prospecto'";
    }
    if (!v.prospectoEmpresa.trim()) return "Ingresa el nombre de la empresa del prospecto";
    if (v.prospectoModo === "nuevo" && !v.prospectoContacto.trim()) {
      return "Ingresa el nombre del contacto del prospecto";
    }
  }
  return null;
}

/**
 * Intenta vincular/crear la oportunidad CRM para la cotización recién creada.
 * Falla suave: no rompe el flujo si CRM falla, sólo notifica.
 */
export async function vincularCrmTrasCrear(
  cotizacionId: string,
  values: CotizacionFormValues,
  toast: ToastFn,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: cotRow } = await supabase
      .from("cotizaciones").select("folio").eq("id", cotizacionId).maybeSingle();
    await vincularOCrearOportunidadParaCotizacion({
      cotizacionId,
      cotizacionFolio: cotRow?.folio,
      modoTransporte: values.modo,
      oportunidadId: values.oportunidadId || null,
      leadId: values.leadId || null,
      prospecto: {
        empresa: values.prospectoEmpresa,
        contacto: values.prospectoContacto,
        email: values.prospectoEmail,
        telefono: values.prospectoTelefono,
      },
      user: user ? { id: user.id, email: user.email ?? undefined } : null,
    });
  } catch (vinculErr) {
    notifyError(toast, {
      title: "Cotización guardada, pero falló el vínculo CRM",
      description: getErrorMessage(vinculErr),
      error: vinculErr,
      method: "VINCULAR_OPORTUNIDAD_CRM",
      context: { cotizacionId },
    });
  }
}
