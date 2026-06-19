import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { DocumentoChecklist } from "@/components/shared/DocumentChecklist";
import { findProveedorByRfcEnOrg, ProveedorDuplicadoError } from "@/features/proveedor/services";
import { useOrgFilter } from "@/hooks/shared";
import {
  DOCS_EXTRANJERO,
  DOCS_NACIONAL,
  EMPTY_PROVEEDOR_FORM,
  type CategoriaProveedor,
  type NuevoProveedorForm,
  type SubtipoGasto,
  type TipoProveedor,
} from "./useNuevoProveedorController.constants";
import { mergeCsfPatch, procesarCsfUpload } from "./useNuevoProveedorController.csf";

import { notifyError } from "@/components/shared/utils/appFeedback";
export {
  DOCS_EXTRANJERO,
  DOCS_NACIONAL,
  EMPTY_PROVEEDOR_FORM,
  type NuevoProveedorForm,
} from "./useNuevoProveedorController.constants";

/**
 * Controller del diálogo de alta de proveedores (wizard 2 pasos).
 * Soporta dos categorías: Logístico (con tipo) y Gasto Operativo (con subtipo_gasto).
 */
export function useNuevoProveedorController(
  onSave: (data: TablesInsert<"proveedores">) => void | Promise<void>,
  onClose: () => void,
) {
  const { organizationId } = useOrgFilter();
  const [form, setForm] = useState<NuevoProveedorForm>({ ...EMPTY_PROVEEDOR_FORM });
  const [rfcDuplicado, setRfcDuplicado] = useState<{ id: string; nombre: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [documentos, setDocumentos] = useState<DocumentoChecklist[]>([]);
  const [csfLoading, setCsfLoading] = useState(false);


  const isLogistico = form.categoria === "Logistico";
  const isGasto = form.categoria === "GastoOperativo";
  const isAgenteCarga = isLogistico && form.tipo === "Agente de Carga";
  const rfcLabel = form.origen_proveedor === "Extranjero" ? "Tax ID" : "RFC";

  const isStep1Valid = (): boolean => {
    if (!form.categoria) return false;
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
    const esGasto = next === "GastoOperativo";
    setForm((prev) => ({
      ...prev,
      categoria: next,
      tipo: next === "Logistico" ? (prev.tipo ?? "Naviera") : null,
      subtipo_gasto: esGasto ? (prev.subtipo_gasto ?? "Otros") : null,
      pais: next === "Logistico" ? prev.pais : "",
      // Gasto operativo: siempre nacional y siempre MXN.
      origen_proveedor: esGasto ? "Nacional" : prev.origen_proveedor,
      moneda_preferida: esGasto ? "MXN" : prev.moneda_preferida,
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
    const lista = form.origen_proveedor === "Extranjero" ? DOCS_EXTRANJERO : DOCS_NACIONAL;
    setDocumentos(lista.map((nombre) => ({ nombre, adjuntado: false })));
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

  // Verifica suavemente si el RFC ya existe en la organización (debounced 300ms).
  useEffect(() => {
    const rfc = form.rfc.trim();
    if (!rfc || !organizationId) {
      setRfcDuplicado(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      findProveedorByRfcEnOrg(rfc, organizationId)
        .then((existente) => setRfcDuplicado(existente))
        .catch(() => setRfcDuplicado(null));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.rfc, organizationId]);

  const handleSave = async () => {
    const clabeTrim = form.clabe.trim();
    if (clabeTrim && !/^\d{18}$/.test(clabeTrim)) {
      notifyError(toast, { title: "La CLABE debe tener exactamente 18 dígitos numéricos.", method: "FEATURES_PROVEEDOR_HOOKS_USENUEVOPROVEEDORCONTROLLER_1" });
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form, clabe: clabeTrim } as TablesInsert<"proveedores">);
      reset();
      onClose();
    } catch (err) {
      if (err instanceof ProveedorDuplicadoError) {
        // El parent ya mostró el toast con CTA; mantener el diálogo abierto.
        return;
      }
      // Otros errores: el parent decide UI; no cerramos.
    } finally {
      setSaving(false);
    }
  };


  const handleCsfUpload = async (file: File) => {
    setCsfLoading(true);
    const patch = await procesarCsfUpload(file);
    if (patch) setForm((prev) => mergeCsfPatch(prev, patch));
    setCsfLoading(false);
  };

  return {
    form,
    step,
    documentos,
    csfLoading,
    isLogistico,
    isGasto,
    isAgenteCarga,
    rfcLabel,
    rfcDuplicado,
    saving,
    isStep1Valid: isStep1Valid(),
    setField,
    setStep,
    handleCategoriaChange,
    handleTipoChange,
    handleSubtipoGastoChange,
    handleNext,
    handleFileChange,
    handleCsfUpload,
    handleSave,
    resetAndClose,
  };
}
