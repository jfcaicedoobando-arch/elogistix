import { useState, useEffect, useMemo } from "react";
import type { Enums, Tables, TablesUpdate } from "@/integrations/supabase/types";

type TipoProveedor = Enums<"tipo_proveedor">;
type Proveedor = Tables<"proveedores">;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Controller del diálogo de edición de proveedor.
 * Estado local del formulario, derivación de errores con touched-fields y mutación.
 */
export function useEditarProveedorController(
  proveedor: Proveedor,
  open: boolean,
  onSave: (id: string, data: TablesUpdate<"proveedores">) => void,
  onClose: () => void,
) {
  const [form, setForm] = useState<Proveedor>({ ...proveedor });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setForm({ ...proveedor });
      setTouched({});
    }
  }, [open, proveedor]);

  const isAgenteCarga = form.tipo === "Agente de Carga";
  const rfcLabel = form.origen_proveedor === "Extranjero" ? "Tax ID" : "RFC";

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.origen_proveedor) e.origen_proveedor = "El origen es requerido";
    if (!form.nombre.trim()) e.nombre = "El nombre es requerido";
    if (!form.rfc.trim()) {
      e.rfc = `El ${form.origen_proveedor === "Extranjero" ? "Tax ID" : "RFC"} es requerido`;
    }
    if (isAgenteCarga && !form.pais) e.pais = "El país es requerido";
    if (form.email && !EMAIL_RE.test(form.email)) e.email = "Email inválido";
    return e;
  }, [form.origen_proveedor, form.nombre, form.rfc, form.pais, form.email, isAgenteCarga]);

  const isValid = Object.keys(errors).length === 0;

  const markTouched = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const setField = <K extends keyof Proveedor>(field: K, value: Proveedor[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleTipoChange = (valorSeleccionado: string) => {
    setForm((prev) => ({
      ...prev,
      tipo: valorSeleccionado as TipoProveedor,
      pais: valorSeleccionado === "Agente de Carga" ? prev.pais : "",
    }));
  };

  const handleSave = () => {
    if (!isValid) {
      setTouched({
        origen_proveedor: true,
        nombre: true,
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
    isAgenteCarga,
    rfcLabel,
    isValid,
    setField,
    markTouched,
    handleTipoChange,
    handleSave,
    fieldErrorMessage,
  };
}
