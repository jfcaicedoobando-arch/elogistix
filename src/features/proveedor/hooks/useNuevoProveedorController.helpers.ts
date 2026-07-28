/**
 * Helpers puros para useNuevoProveedorController.
 * Validación de CLABE/SWIFT y normalización del payload.
 */
import type { TablesInsert } from "@/integrations/supabase/types";
import type { NuevoProveedorForm } from "./useNuevoProveedorController.constants";

const CLABE_RE = /^\d{18}$/;
const SWIFT_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

// B-025 (v13.320.43): validación de dígito verificador CLABE (mod-10 con pesos 3-7-1).
// Suma cada uno de los primeros 17 dígitos multiplicado por [3,7,1] cíclico,
// toma el residuo mod 10 de cada producto, luego (10 - suma%10) % 10 debe = dígito 18.
// Fuente: NOM-006-SCFI-1994 / especificación Banxico.
const CLABE_WEIGHTS = [3, 7, 1] as const;
function clabeDigitoVerificadorValido(clabe: string): boolean {
  if (!CLABE_RE.test(clabe)) return false;
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    suma += (Number(clabe[i]) * CLABE_WEIGHTS[i % 3]) % 10;
  }
  const dv = (10 - (suma % 10)) % 10;
  return dv === Number(clabe[17]);
}


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
