import { useState, useEffect, useMemo } from "react";
import type { Enums, Tables, TablesUpdate } from "@/integrations/supabase/types";

type TipoProveedor = Enums<"tipo_proveedor">;
type CategoriaProveedor = Enums<"categoria_proveedor">;
type SubtipoGasto = Enums<"subtipo_gasto_operativo">;
type Proveedor = Tables<"proveedores">;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Campos string que deben renderse como "" (no null) para mantener
// los inputs/selects controlados.
const STRING_FIELDS = [
  "nombre", "rfc", "contacto", "email", "telefono", "pais",
  "cp", "direccion", "ciudad", "estado", "regimen_fiscal",
  "banco", "clabe", "banco_pais", "swift_bic", "iban", "aba_routing",
  "banco_direccion", "banco_intermediario", "banco_intermediario_swift",
  "beneficiario", "referencia_pago",
] as const satisfies ReadonlyArray<keyof Proveedor>;

function normalizarProveedor(p: Proveedor): Proveedor {
  const overrides: Partial<Proveedor> = {};
  for (const f of STRING_FIELDS) {
    // SAFE-CAST: cada f está acotado a keys cuyo tipo en DB es `string | null`.
    (overrides as Record<string, string>)[f] = (p[f] as string | null) ?? "";
  }
  return { ...p, ...overrides };
}

/**
 * Controller del diálogo de edición de proveedor.
 * Soporta categorías Logístico (con tipo) y Gasto Operativo (con subtipo_gasto).
 */
export function useEditarProveedorController(
  proveedor: Proveedor,
  open: boolean,
  onSave: (id: string, data: TablesUpdate<"proveedores">) => void,
  onClose: () => void,
) {
  // Campos string que deben renderse como "" (no null) para mantener
  // los inputs/selects controlados.
  const STRING_FIELDS = [
    "nombre", "rfc", "contacto", "email", "telefono", "pais",
    "cp", "direccion", "ciudad", "estado", "regimen_fiscal",
    "banco", "clabe", "banco_pais", "swift_bic", "iban", "aba_routing",
    "banco_direccion", "banco_intermediario", "banco_intermediario_swift",
    "beneficiario", "referencia_pago",
  ] as const satisfies ReadonlyArray<keyof Proveedor>;

  const normalizar = (p: Proveedor): Proveedor => {
    const overrides: Partial<Proveedor> = {};
    for (const f of STRING_FIELDS) {
      // SAFE-CAST: cada f está acotado a keys cuyo tipo en DB es `string | null`.
      (overrides as Record<string, string>)[f] = (p[f] as string | null) ?? "";
    }
    return { ...p, ...overrides };
  };

  const [form, setForm] = useState<Proveedor>(() => normalizar(proveedor));
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setForm(normalizar(proveedor));
      setTouched({});
    }
  }, [open, proveedor]);

  const isLogistico = form.categoria === "Logistico";
  const isGasto = form.categoria === "GastoOperativo";
  const isAgenteCarga = isLogistico && form.tipo === "Agente de Carga";
  const rfcLabel = form.origen_proveedor === "Extranjero" ? "Tax ID" : "RFC";

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.origen_proveedor) e.origen_proveedor = "El origen es requerido";
    if (!form.nombre.trim()) e.nombre = "El nombre es requerido";
    if (isLogistico && !form.tipo) e.tipo = "El tipo es requerido";
    if (isGasto && !form.subtipo_gasto) e.subtipo_gasto = "El subtipo de gasto es requerido";
    if (!form.rfc.trim()) {
      e.rfc = `El ${form.origen_proveedor === "Extranjero" ? "Tax ID" : "RFC"} es requerido`;
    }
    if (isAgenteCarga && !form.pais) e.pais = "El país es requerido";
    if (form.email && !EMAIL_RE.test(form.email)) e.email = "Email inválido";
    return e;
  }, [form.origen_proveedor, form.nombre, form.rfc, form.pais, form.email, form.tipo, form.subtipo_gasto, isAgenteCarga, isLogistico, isGasto]);

  const isValid = Object.keys(errors).length === 0;

  const markTouched = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const setField = <K extends keyof Proveedor>(field: K, value: Proveedor[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleCategoriaChange = (valor: string) => {
    const next = valor as CategoriaProveedor;
    setForm((prev) => ({
      ...prev,
      categoria: next,
      tipo: next === "Logistico" ? (prev.tipo ?? "Naviera") : null,
      subtipo_gasto: next === "GastoOperativo" ? (prev.subtipo_gasto ?? "Otros") : null,
      pais: next === "Logistico" ? prev.pais : "",
    }));
  };

  const handleTipoChange = (valorSeleccionado: string) => {
    setForm((prev) => ({
      ...prev,
      tipo: valorSeleccionado as TipoProveedor,
      pais: valorSeleccionado === "Agente de Carga" ? prev.pais : "",
    }));
  };

  const handleSubtipoGastoChange = (valor: string) => {
    setForm((prev) => ({ ...prev, subtipo_gasto: valor as SubtipoGasto }));
  };

  const handleSave = () => {
    if (!isValid) {
      setTouched({
        origen_proveedor: true,
        nombre: true,
        tipo: true,
        subtipo_gasto: true,
        rfc: true,
        pais: true,
        email: true,
      });
      return;
    }
    onSave(proveedor.id, form);
    onClose();
  };

  const fieldErrorMessage = (field: string): string | null =>
    touched[field] && errors[field] ? errors[field] : null;

  return {
    form,
    isLogistico,
    isGasto,
    isAgenteCarga,
    rfcLabel,
    isValid,
    setField,
    markTouched,
    handleCategoriaChange,
    handleTipoChange,
    handleSubtipoGastoChange,
    handleSave,
    fieldErrorMessage,
  };
}
