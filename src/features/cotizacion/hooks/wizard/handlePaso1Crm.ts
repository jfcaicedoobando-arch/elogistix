/**
 * Helpers para el paso 1 del wizard de cotización:
 * - Validación de los campos de destinatario (cliente vs prospecto).
 * - Vinculación CRM (lead/oportunidad) tras crear la cotización nueva.
 *
 * Extraído de `useCotizacionWizardSteps` en 12.1.0 para cumplir Power of 10.
 * v12.14.3: la I/O de Supabase vive ahora en `services/cotizacion/wizard/paso1Crm`.
 */
import {
  obtenerUsuarioActual,
  fetchCotizacionFolio,
} from "@/features/cotizacion/services/wizard/paso1Crm";
import { vincularOCrearOportunidadParaCotizacion } from "@/features/crm/services/vincularCotizacion";
import { getErrorMessage } from "@/lib/errors";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { supabase } from "@/integrations/supabase/client";
import { toDbJson } from "@/lib/supabase/cast";
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
  if (v.modo === "Terrestre") {
    if (!v.modalidadEquipo?.trim()) return "Selecciona la modalidad de equipo";
    if (v.modalidadEquipo === "Porta Contenedor" && !v.puntoIntermedio?.trim()) {
      return "Captura el punto de carga/descarga";
    }
  }
  // v13.35.0 — Política tarifa-first: marítimo requiere tarifa vinculada.
  if (v.modo === "Marítimo" && !v.tarifaId) {
    void logBloqueoSinTarifa(v);
    return "Vincula o crea una tarifa marítima antes de continuar (Paso 1 → Tarifa marítima vinculada).";
  }
  return null;
}

/**
 * Registra en bitácora cuando el bloqueo tarifa-first detiene el avance.
 * Best-effort: si falla, no rompe el flujo de validación.
 */
async function logBloqueoSinTarifa(v: CotizacionFormValues): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("bitacora_actividad").insert({
      usuario_id: user.id,
      usuario_email: user.email ?? "",
      accion: "cotizacion_bloqueada_sin_tarifa",
      modulo: "Cotizaciones",
      entidad_id: null,
      entidad_nombre: v.esProspecto ? v.prospectoEmpresa : (v.clienteId ?? ""),
      detalles: toDbJson({
        origen: v.origen ?? null,
        destino: v.destino ?? null,
        tipo_contenedor: v.tipoContenedor ?? null,
      }),
    });
  } catch {
    // Best-effort.
  }
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
    const user = await obtenerUsuarioActual();
    const folio = await fetchCotizacionFolio(cotizacionId);
    await vincularOCrearOportunidadParaCotizacion({
      cotizacionId,
      cotizacionFolio: folio ?? undefined,
      modoTransporte: values.modo,
      oportunidadId: values.oportunidadId || null,
      leadId: values.leadId || null,
      prospecto: {
        empresa: values.prospectoEmpresa,
        contacto: values.prospectoContacto,
        email: values.prospectoEmail,
        telefono: values.prospectoTelefono,
      },
      user,
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
