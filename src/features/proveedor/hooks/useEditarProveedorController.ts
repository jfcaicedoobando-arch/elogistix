import { useState, useEffect, useMemo } from "react";
import { validarDatosBancarios } from "@/lib/domain/datosBancarios";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";
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
  onSave: (
    id: string,
    data: TablesUpdate<"proveedores">,
    expectedUpdatedAt?: string | null,
    organizationId?: string | null,
  ) => Promise<unknown>,
  onClose: () => void,
) {
  const [form, setForm] = useState<Proveedor>(() => normalizarProveedor(proveedor));
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setForm(normalizarProveedor(proveedor));
      setTouched({});
    }
  }, [open, proveedor]);

  const isLogistico = form.categoria === "Logistico";
  const isGasto = form.categoria === "GastoOperativo";
  const isAgenteCarga = isLogistico && form.tipo === "Agente de Carga";
  const rfcLabel = form.origen_proveedor === "Extranjero" ? "Tax ID" : "RFC";

  const esExtranjero = form.origen_proveedor === "Extranjero";

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.origen_proveedor) e.origen_proveedor = "El origen es requerido";
    if (!form.nombre.trim()) e.nombre = "El nombre es requerido";
    // El tipo sólo se requiere para proveedores extranjeros logísticos.
    if (isLogistico && esExtranjero && !form.tipo) e.tipo = "El tipo es requerido";
    if (isGasto && !form.subtipo_gasto) e.subtipo_gasto = "El subtipo de gasto es requerido";
    if (!form.rfc.trim()) {
      e.rfc = `El ${form.origen_proveedor === "Extranjero" ? "Tax ID" : "RFC"} es requerido`;
    }
    if (isAgenteCarga && !form.pais) e.pais = "El país es requerido";
    if (form.email && !EMAIL_RE.test(form.email)) e.email = COPY_VALIDACION.correoInvalido;
    // P2-1 (R5): antes se podía guardar una CLABE de 17 dígitos sin aviso.
    const errBanco = validarDatosBancarios({
      esExtranjero,
      clabe: form.clabe,
      swiftBic: form.swift_bic,
    });
    if (errBanco) e[errBanco.campo] = errBanco.mensaje;
    return e;
  }, [form.origen_proveedor, form.nombre, form.rfc, form.pais, form.email, form.tipo, form.subtipo_gasto, form.clabe, form.swift_bic, isAgenteCarga, isLogistico, isGasto, esExtranjero]);

  const isValid = Object.keys(errors).length === 0;

  const markTouched = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const setField = <K extends keyof Proveedor>(field: K, value: Proveedor[K]) =>
    setForm((prev) => {
      const next = { ...prev, [field]: value } as Proveedor;
      if (field === "origen_proveedor" && value === "Nacional") {
        next.tipo = null;
        next.pais = "";
      }
      return next;
    });

  const handleCategoriaChange = (valor: string) => {
    const next = valor as CategoriaProveedor;
    setForm((prev) => ({
      ...prev,
      categoria: next,
      // No autoseleccionamos tipo; sólo aplica para Extranjero y lo elige el usuario.
      tipo: next === "Logistico" ? prev.tipo : null,
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

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!isValid) {
      setTouched({
        origen_proveedor: true,
        nombre: true,
        tipo: true,
        subtipo_gasto: true,
        rfc: true,
        pais: true,
        email: true,
        clabe: true,
        swift_bic: true,
      });
      return;
    }
    // Q: el diálogo sólo debe cerrar tras confirmar el guardado. Si hay
    // conflicto de concurrencia (u otro error), `onSave` rechaza la promesa
    // (el toast lo emite `useProveedorMutations.onError`) y dejamos el
    // formulario abierto para que el usuario reintente con datos frescos.
    setIsSaving(true);
    try {
      await onSave(proveedor.id, form, proveedor.updated_at, proveedor.organization_id);
      onClose();
    } catch {
      // Silencioso a propósito: el error ya se notificó vía toast.
    } finally {
      setIsSaving(false);
    }
  };

  const fieldErrorMessage = (field: string): string | null =>
    touched[field] && errors[field] ? errors[field] : null;

  return {
    form,
    isSaving,
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
