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
  motivo: "clabe" | "swift" | "categoria" | "tipo" | "subtipo";
  mensaje: string;
}

/**
 * R-03 — whitelist explícita de columnas de `public.proveedores`. Antes se
 * enviaba `{...form}` completo: cualquier campo auxiliar del formulario
 * llegaba al insert y el servidor devolvía un error genérico.
 */
const COLUMNAS_PROVEEDOR = [
  "nombre", "categoria", "tipo", "subtipo_gasto", "pais", "rfc", "contacto",
  "email", "telefono", "moneda_preferida", "origen_proveedor", "dias_credito",
  "cp", "direccion", "ciudad", "estado", "regimen_fiscal", "banco", "clabe",
  "swift_bic", "iban", "aba_routing", "banco_pais", "banco_direccion",
  "banco_intermediario", "banco_intermediario_swift", "beneficiario",
  "referencia_pago",
] as const;

function soloColumnas(form: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of COLUMNAS_PROVEEDOR) {
    if (col in form) out[col] = form[col];
  }
  return out;
}

/** Coherencia categoría ↔ tipo/subtipo, validada antes de tocar el servidor. */
function validarCategoria(form: NuevoProveedorForm): PayloadInvalido | null {
  if (!form.categoria) {
    return { ok: false, motivo: "categoria", mensaje: "Selecciona la categoría del proveedor." };
  }
  if (form.categoria === "Logistico" && !form.tipo) {
    return { ok: false, motivo: "tipo", mensaje: "Selecciona el tipo de proveedor logístico (Naviera, Transportista, etc.)." };
  }
  if (form.categoria === "GastoOperativo" && !form.subtipo_gasto) {
    return { ok: false, motivo: "subtipo", mensaje: "Selecciona el subtipo de gasto operativo." };
  }
  return null;
}

export function preparePayload(form: NuevoProveedorForm): PayloadValidado | PayloadInvalido {
  const esExtranjero = form.origen_proveedor === "Extranjero";
  const clabeTrim = form.clabe.trim();
  const swiftTrim = form.swift_bic.trim().toUpperCase();
  if (!esExtranjero && clabeTrim && !CLABE_RE.test(clabeTrim)) {
    return { ok: false, motivo: "clabe", mensaje: "La CLABE debe tener exactamente 18 dígitos numéricos." };
  }
  if (!esExtranjero && clabeTrim && !clabeDigitoVerificadorValido(clabeTrim)) {
    return { ok: false, motivo: "clabe", mensaje: "La CLABE tiene un dígito verificador inválido — revisa que no tenga errores de tipeo." };
  }
  if (esExtranjero && swiftTrim && !SWIFT_RE.test(swiftTrim)) {
    return { ok: false, motivo: "swift", mensaje: "El SWIFT/BIC debe tener 8 u 11 caracteres alfanuméricos." };
  }

  const errorCategoria = validarCategoria(form);
  if (errorCategoria) return errorCategoria;

  const normalizado: NuevoProveedorForm = esExtranjero
    ? { ...form, clabe: "", swift_bic: swiftTrim }
    : { ...form, clabe: clabeTrim };
  // Coherencia de enums: un logístico nunca lleva subtipo de gasto y viceversa.
  const conEnums = {
    ...normalizado,
    tipo: normalizado.categoria === "Logistico" ? normalizado.tipo : null,
    subtipo_gasto: normalizado.categoria === "GastoOperativo" ? normalizado.subtipo_gasto : null,
  };
  // SAFE-CAST: `soloColumnas` deja exactamente las columnas de la tabla.
  return { ok: true, payload: soloColumnas(conEnums) as TablesInsert<"proveedores"> };
}
