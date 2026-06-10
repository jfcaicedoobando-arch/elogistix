import { useState } from "react";
import { toast } from "sonner";
import type { Enums, TablesInsert } from "@/integrations/supabase/types";
import type { DocumentoChecklist } from "@/components/shared/DocumentChecklist";
import { parseCsf } from "@/services/csf";


type TipoProveedor = Enums<"tipo_proveedor">;
type Moneda = Enums<"moneda">;
type CategoriaProveedor = Enums<"categoria_proveedor">;
type SubtipoGasto = Enums<"subtipo_gasto_operativo">;

export const DOCS_NACIONAL = [
  "CIF",
  "Opinión fiscal",
  "Acta constitutiva",
  "INE RL",
  "Poder notarial",
  "Comprobante de domicilio",
  "Datos bancarios",
];

export const DOCS_EXTRANJERO = [
  "Certificado de ID",
  "Comprobante de domicilio",
  "Documento que acredite su legalidad",
  "Identificación del RL",
  "Datos bancarios",
  "Poder notarial del RL",
];

export const EMPTY_PROVEEDOR_FORM = {
  nombre: "",
  categoria: "Logistico" as CategoriaProveedor,
  tipo: "Naviera" as TipoProveedor | null,
  subtipo_gasto: null as SubtipoGasto | null,
  pais: "",
  rfc: "",
  contacto: "",
  email: "",
  telefono: "",
  moneda_preferida: "MXN" as Moneda,
  origen_proveedor: null as "Nacional" | "Extranjero" | null,
};

export type NuevoProveedorForm = typeof EMPTY_PROVEEDOR_FORM;

/**
 * Controller del diálogo de alta de proveedores (wizard 2 pasos).
 * Soporta dos categorías: Logístico (con tipo) y Gasto Operativo (con subtipo_gasto).
 */
export function useNuevoProveedorController(
  onSave: (data: TablesInsert<"proveedores">) => void,
  onClose: () => void,
) {
  const [form, setForm] = useState<NuevoProveedorForm>({ ...EMPTY_PROVEEDOR_FORM });
  const [step, setStep] = useState<1 | 2>(1);
  const [documentos, setDocumentos] = useState<DocumentoChecklist[]>([]);

  const isLogistico = form.categoria === "Logistico";
  const isGasto = form.categoria === "GastoOperativo";
  const isAgenteCarga = isLogistico && form.tipo === "Agente de Carga";
  const rfcLabel = form.origen_proveedor === "Extranjero" ? "Tax ID" : "RFC";

  const isStep1Valid = (): boolean => {
    if (!form.nombre.trim()) return false;
    if (!form.origen_proveedor) return false;
    if (isLogistico) {
      if (!form.tipo) return false;
      if (isAgenteCarga && !form.pais) return false;
    }
    if (isGasto && !form.subtipo_gasto) return false;
    if (!form.rfc.trim()) return false;
    return true;
  };

  const setField = <K extends keyof NuevoProveedorForm>(field: K, value: NuevoProveedorForm[K]) =>
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

  const handleNext = () => {
    if (!isStep1Valid()) return;
    const docNames = form.origen_proveedor === "Nacional" ? DOCS_NACIONAL : DOCS_EXTRANJERO;
    setDocumentos(docNames.map((nombre) => ({ nombre, adjuntado: false })));
    setStep(2);
  };

  const handleFileChange = (docNombre: string, file: File | undefined) => {
    setDocumentos((prev) =>
      prev.map((d) =>
        d.nombre === docNombre ? { ...d, archivo: file?.name, adjuntado: !!file } : d,
      ),
    );
  };

  const reset = () => {
    setForm({ ...EMPTY_PROVEEDOR_FORM });
    setStep(1);
    setDocumentos([]);
  };

  const resetAndClose = () => {
    reset();
    onClose();
  };

  const handleSave = () => {
    onSave(form as TablesInsert<"proveedores">);
    resetAndClose();
  };

  return {
    form,
    step,
    documentos,
    isLogistico,
    isGasto,
    isAgenteCarga,
    rfcLabel,
    isStep1Valid: isStep1Valid(),
    setField,
    setStep,
    handleCategoriaChange,
    handleTipoChange,
    handleSubtipoGastoChange,
    handleNext,
    handleFileChange,
    handleSave,
    resetAndClose,
  };
}
