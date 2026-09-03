/**
 * Helpers para el paso 1 del wizard de cotización:
 * - Validación de los campos de destinatario (cliente vs prospecto).
 * - Vinculación CRM (lead/oportunidad) tras crear la cotización nueva.
 *
 * Extraído de `useCotizacionWizardSteps` en 12.1.0 para cumplir Power of 10.
 * v12.14.3: la I/O de Supabase vive ahora en `services/cotizacion/wizard/paso1Crm`.
 */
import { registrarBloqueoSinTarifa } from "@/features/cotizacion/services/wizard/paso1Crm";
import { vincularOCrearOportunidadParaCotizacion } from "@/features/crm/services/vincularCotizacion";
import type { VincularResult } from "@/features/crm/services/vincularCotizacion/vincularOCrear";

import { esIncotermSinFleteVenta } from "@/features/cotizacion/utils/incotermRules";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import {
  destinatarioSchema,
  datosGeneralesSchema,
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

/**
 * VB-41: los datos generales obligatorios del borrador se validan aquí (antes
 * sólo fallaban en el boundary de mutación con un mensaje técnico).
 */
export function validateDatosGenerales(v: CotizacionFormValues): string | null {
  return primerError(datosGeneralesSchema, {
    modo: v.modo ?? "",
    tipo: v.tipo ?? "",
    incoterm: v.incoterm ?? "",
    descripcionMercancia: v.descripcionMercancia ?? "",
    origen: v.origen ?? "",
    destino: v.destino ?? "",
  });
}

export function validatePaso1(v: CotizacionFormValues): string | null {
  return (
    validateCliente(v) ??
    validateDatosGenerales(v) ??
    validateProspecto(v) ??
    validateTerrestre(v) ??
    validateMaritimo(v)
  );
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
 * Vincula la cotización a su origen CRM (lead u oportunidad existente).
 *
 * P0: ya NO es "falla suave". Si el vínculo falla se propaga el error para que
 * el wizard se quede en el paso 1 (con toda la captura y el mismo
 * `cotizacionId`) y ofrezca reintentar. Devuelve los IDs canónicos y el
 * `updated_at` resultante para resincronizar el bloqueo optimista.
 */
export async function vincularCrmTrasCrear(
  cotizacionId: string,
  values: CotizacionFormValues,
): Promise<VincularResult> {
  return await vincularOCrearOportunidadParaCotizacion({
    cotizacionId,
    oportunidadId: values.oportunidadId || null,
    leadId: values.leadId || null,
  });
}

