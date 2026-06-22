/**
 * Helpers puros para useNuevoProveedorController.
 * Validación de CLABE/SWIFT y normalización del payload.
 */
import type { TablesInsert } from "@/integrations/supabase/types";
import type { NuevoProveedorForm } from "./useNuevoProveedorController.constants";

const CLABE_RE = /^\d{18}$/;
const SWIFT_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export interface PayloadValidado {
  ok: true;
  payload: TablesInsert<"proveedores">;
}
export interface PayloadInvalido {
  ok: false;
  motivo: "clabe" | "swift";
  mensaje: string;
}

export function preparePayload(form: NuevoProveedorForm): PayloadValidado | PayloadInvalido {
  const esExtranjero = form.origen_proveedor === "Extranjero";
  const clabeTrim = form.clabe.trim();
  const swiftTrim = form.swift_bic.trim().toUpperCase();
  if (!esExtranjero && clabeTrim && !CLABE_RE.test(clabeTrim)) {
    return { ok: false, motivo: "clabe", mensaje: "La CLABE debe tener exactamente 18 dígitos numéricos." };
  }
  if (esExtranjero && swiftTrim && !SWIFT_RE.test(swiftTrim)) {
    return { ok: false, motivo: "swift", mensaje: "El SWIFT/BIC debe tener 8 u 11 caracteres alfanuméricos." };
  }
  const payload = esExtranjero
    ? { ...form, clabe: "", swift_bic: swiftTrim }
    : { ...form, clabe: clabeTrim };
  // SAFE-CAST: el form contiene exactamente los campos requeridos por la tabla.
  return { ok: true, payload: payload as TablesInsert<"proveedores"> };
}
