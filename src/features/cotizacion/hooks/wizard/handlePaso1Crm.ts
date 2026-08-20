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
import {
  destinatarioSchema,
  rutaTerrestreSchema,
  fleteLclManualSchema,
  primerError,
} from "@/features/cotizacion/domain/schemas/wizardPasos";


// ── Pure sub-validators ──────────────────────────────────────────────────────

/**
 * EC-4: las reglas viven en schemas zod (`domain/schemas/wizardPasos`); estos
 * wrappers sólo adaptan el form al input del schema y devuelven el 1er mensaje.
 */
export function validateCliente(v: CotizacionFormValues): string | null {
  if (v.esProspecto) return null;
  return primerError(destinatarioSchema, {
    esProspecto: false,
    clienteId: v.clienteId ?? null,
    prospectoEmpresa: "",
    prospectoContacto: "",
  });
}

export function validateProspecto(v: CotizacionFormValues): string | null {
  if (!v.esProspecto) return null;
  return primerError(destinatarioSchema, {
    esProspecto: true,
    clienteId: v.clienteId ?? null,
    prospectoModo: v.prospectoModo,
    oportunidadId: v.oportunidadId ?? null,
    leadId: v.leadId ?? null,
    prospectoEmpresa: v.prospectoEmpresa ?? "",
    prospectoContacto: v.prospectoContacto ?? "",
  });
}

export function validateTerrestre(v: CotizacionFormValues): string | null {
  return primerError(rutaTerrestreSchema, {
    modo: v.modo,
    modalidadEquipo: v.modalidadEquipo ?? null,
    puntoIntermedio: v.puntoIntermedio ?? null,
  });
}

function validateLclFleteManual(v: CotizacionFormValues): string | null {
  return primerError(fleteLclManualSchema, {
    tarifaWM: v.lclFleteManual?.tarifaWM ?? 0,
    consolidadorId: v.lclFleteManual?.consolidadorId ?? null,
  });
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

// ── Validación inline (VF-09 / VB-34) ────────────────────────────────────────

/**
 * Mapea un mensaje de `validatePaso1` al campo del form que debe marcarse en
 * rojo. La implementación vive en `scrollToErrorSection` (única fuente de
 * verdad); aquí se reexporta para el API público del Paso 1.
 */
export { campoParaErrorPaso1 } from "./scrollToErrorSection";

/**
 * Mapea el `path` de un issue del schema de mutación (`mutationSchemas.ts`)
 * al campo del form del Paso 1. Los campos requeridos del borrador que no
 * cubre `validatePaso1` (modo/tipo/incoterm/descripción/origen/destino)
 * fallan al guardar; así se marcan inline además del toast.
 */
export function campoParaPathSchemaPaso1(path: string): string | null {
  const map: Record<string, string> = {
    cliente_nombre: "clienteId",
    modo: "modo",
    tipo: "tipo",
    incoterm: "incoterm",
    descripcion_mercancia: "descripcionMercancia",
    origen: "origen",
    destino: "destino",
  };
  return map[path] ?? null;
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
        rfc: values.prospectoRfc,
        direccion: values.prospectoDireccion,
        ciudad: values.prospectoCiudad,
        entidadFederativa: values.prospectoEntidadFederativa,
        cp: values.prospectoCp,
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
