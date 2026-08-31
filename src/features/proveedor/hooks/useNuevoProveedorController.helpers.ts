/**
 * Helpers puros para useNuevoProveedorController.
 * Validación de CLABE/SWIFT y normalización del payload.
 */
import type { TablesInsert } from "@/integrations/supabase/types";
import type { NuevoProveedorForm } from "./useNuevoProveedorController.constants";
// P2-1 (R5): validación bancaria compartida con el modal de edición.
import { validarDatosBancarios } from "@/lib/domain/datosBancarios";


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
  const errBanco = validarDatosBancarios({ esExtranjero, clabe: clabeTrim, swiftBic: swiftTrim });
  if (errBanco) {
    return {
      ok: false,
      motivo: errBanco.campo === "clabe" ? "clabe" : "swift",
      mensaje: errBanco.mensaje,
    };
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

/**
 * Campos que faltan en el paso 1 del alta de proveedor (YG-06).
 * Vive aquí (y no en el hook) para mantener el controller bajo 200 líneas y
 * poder probar la validación como función pura.
 */
export function faltantesPaso1Proveedor(
  form: NuevoProveedorForm,
  rfcLabel: string,
): string[] {
  const isLogistico = form.categoria === "Logistico";
  const isAgenteCarga = isLogistico && form.tipo === "Agente de Carga";
  const items: string[] = [];
  if (!form.categoria) items.push("categoría");
  if (!form.nombre.trim()) items.push("nombre");
  if (!form.origen_proveedor) items.push("origen (nacional/extranjero)");
  if (!form.rfc.trim()) items.push(rfcLabel);
  // `tipo` es obligatorio para TODO Logístico: el CHECK
  // `proveedores_categoria_check` exige tipo IS NOT NULL en esa categoría.
  if (isLogistico && !form.tipo) items.push("tipo de proveedor logístico");
  if (isAgenteCarga && !form.pais) items.push("país");
  if (form.categoria === "GastoOperativo" && !form.subtipo_gasto) items.push("subtipo de gasto");
  return items;
}
