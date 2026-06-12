/**
 * Helper extraído de useNuevoProveedorController:
 * Sube un PDF de Constancia de Situación Fiscal y devuelve el patch parcial
 * que el controller fusionará en el form. Solo aplica a proveedores nacionales.
 */
import { toast } from "sonner";
import { parseCsf } from "@/services/csf";
import type { NuevoProveedorForm } from "./useNuevoProveedorController.constants";

export type CsfPatch = Partial<
  Pick<
    NuevoProveedorForm,
    "nombre" | "rfc" | "cp" | "direccion" | "ciudad" | "estado" | "regimen_fiscal"
  >
>;

export async function procesarCsfUpload(file: File): Promise<CsfPatch | null> {
  try {
    const data = await parseCsf(file);
    toast.success("CSF procesada. Verifica los datos extraídos.");
    return {
      nombre: data.nombre?.trim() || undefined,
      rfc: data.rfc?.trim() || undefined,
      cp: data.cp?.trim() || undefined,
      direccion: data.direccion?.trim() || undefined,
      ciudad: data.ciudad?.trim() || undefined,
      estado: data.estado?.trim() || undefined,
      regimen_fiscal: data.regimen_fiscal?.trim() || undefined,
    };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo procesar la CSF";
    toast.error(mensaje);
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
