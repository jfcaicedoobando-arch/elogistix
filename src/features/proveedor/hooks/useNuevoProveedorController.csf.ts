/**
 * Helper extraído de useNuevoProveedorController:
 * Sube un PDF de Constancia de Situación Fiscal y devuelve el patch parcial
 * que el controller fusionará en el form. Solo aplica a proveedores nacionales.
 */
import { notifySuccess } from "@/lib/ui/appFeedback";
import { parseCsf, type CsfParsedData } from "@/features/cliente/services/csf";
import type { NuevoProveedorForm } from "./useNuevoProveedorController.constants";

import { notifyError } from "@/lib/ui/appFeedback";
export type CsfPatch = Partial<
  Pick<
    NuevoProveedorForm,
    "nombre" | "rfc" | "cp" | "direccion" | "ciudad" | "estado" | "regimen_fiscal"
  >
>;

function buildCsfPatch(data: CsfParsedData): CsfPatch {
  return {
    nombre: data.nombre?.trim() || undefined,
    rfc: data.rfc?.trim() || undefined,
    cp: data.cp?.trim() || undefined,
    direccion: data.direccion?.trim() || undefined,
    ciudad: data.ciudad?.trim() || undefined,
    estado: data.estado?.trim() || undefined,
    regimen_fiscal: data.regimen_fiscal?.trim() || undefined,
  };
}

export async function procesarCsfUpload(file: File): Promise<CsfPatch | null> {
  try {
    const data = await parseCsf(file);
    notifySuccess(undefined, { title: "CSF procesada. Verifica los datos extraídos." });
    return buildCsfPatch(data);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo procesar la CSF";
    notifyError(undefined, { title: mensaje, error: err, method: "FEATURES_PROVEEDOR_HOOKS_USENUEVOPROVEEDORCONTROLLER.CSF_1" });
    return null;
  }
}

export function mergeCsfPatch(prev: NuevoProveedorForm, patch: CsfPatch): NuevoProveedorForm {
  return {
    ...prev,
    nombre: patch.nombre ?? prev.nombre,
    rfc: patch.rfc ?? prev.rfc,
    cp: patch.cp ?? prev.cp,
    direccion: patch.direccion ?? prev.direccion,
    ciudad: patch.ciudad ?? prev.ciudad,
    estado: patch.estado ?? prev.estado,
    regimen_fiscal: patch.regimen_fiscal ?? prev.regimen_fiscal,
  };
}
