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
  registrarBloqueoSinTarifa,
} from "@/features/cotizacion/services/wizard/paso1Crm";
import { vincularOCrearOportunidadParaCotizacion } from "@/features/crm/services/vincularCotizacion";
import { getErrorMessage } from "@/lib/errors";
import { notifyError } from "@/lib/ui/appFeedback";
import { esIncotermSinFleteVenta } from "@/features/cotizacion/utils/incotermRules";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";


// ── Pure sub-validators ──────────────────────────────────────────────────────

export function validateCliente(v: CotizacionFormValues): string | null {
  if (!v.esProspecto && !v.clienteId) return "Selecciona un cliente";
  return null;
}

export function validateProspecto(v: CotizacionFormValues): string | null {
  if (!v.esProspecto) return null;
  if (v.prospectoModo === "vincular" && !v.oportunidadId && !v.leadId) {
    return "Selecciona un lead u oportunidad existente, o cambia a 'Crear nuevo prospecto'";
  }
  if (!v.prospectoEmpresa.trim()) return "Ingresa el nombre de la empresa del prospecto";
  if (v.prospectoModo === "nuevo" && !v.prospectoContacto.trim()) {
    return "Ingresa el nombre del contacto del prospecto";
  }
  return null;
}

export function validateTerrestre(v: CotizacionFormValues): string | null {
  if (v.modo !== "Terrestre") return null;
  if (!v.modalidadEquipo?.trim()) return "Selecciona la modalidad de equipo";
  if (v.modalidadEquipo === "Porta Contenedor" && !v.puntoIntermedio?.trim()) {
    return "Captura el punto de carga/descarga";
  }
  return null;
}

function validateLclFleteManual(v: CotizacionFormValues): string | null {
  const tarifaWM = Number(v.lclFleteManual?.tarifaWM ?? 0);
  const consolidador = v.lclFleteManual?.consolidadorId?.trim() ?? "";
  if (tarifaWM > 0 && consolidador) return null;
  return "Captura el flete LCL (Tarifa W/M y Consolidador) antes de continuar (Paso 1 → Flete LCL).";
}

export function validateMaritimo(v: CotizacionFormValues): string | null {
  if (v.modo !== "Marítimo" || v.tarifaId) return null;
  if (esIncotermSinFleteVenta(v.incoterm, v.modo)) return null;
  if (v.tipoEmbarque === "LCL") return validateLclFleteManual(v);
  void registrarBloqueoSinTarifa({
    entidadNombre: v.esProspecto ? v.prospectoEmpresa : (v.clienteId ?? ""),
    origen: v.origen ?? null,
    destino: v.destino ?? null,
    tipoContenedor: v.tipoContenedor ?? null,
  });
  return "Vincula o crea una tarifa marítima antes de continuar (Paso 1 → Tarifa marítima vinculada).";
}

// ── Combined validator (public API) ─────────────────────────────────────────

export function validatePaso1(v: CotizacionFormValues): string | null {
  return validateCliente(v) ?? validateProspecto(v) ?? validateTerrestre(v) ?? validateMaritimo(v);
}

/**
 * Intenta vincular/crear la oportunidad CRM para la cotización recién creada.
 * Falla suave: no rompe el flujo si CRM falla, sólo notifica.
 */
export async function vincularCrmTrasCrear(
  cotizacionId: string,
  values: CotizacionFormValues,
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
    notifyError(undefined, {
      title: "Cotización guardada, pero falló el vínculo CRM",
      description: getErrorMessage(vinculErr),
      error: vinculErr,
      method: "VINCULAR_OPORTUNIDAD_CRM",
      context: { cotizacionId },
    });
  }
}
