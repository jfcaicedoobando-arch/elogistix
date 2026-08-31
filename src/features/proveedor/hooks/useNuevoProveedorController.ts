import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { DocumentoChecklist } from "@/components/shared/DocumentChecklist";
import { findProveedorByRfcEnOrg, ProveedorDuplicadoError } from "@/features/proveedor/services";
import { proveedores as proveedoresKeys } from "@/features/proveedor/queryKeys";
import { useOrgFilter } from "@/hooks/shared";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
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
import { formInicialProveedor, type PrefillProveedor } from "./useNuevoProveedorController.prefill";
import { preparePayload } from "./useNuevoProveedorController.helpers";
import { notifyError } from "@/lib/ui/appFeedback";

export {    type NuevoProveedorForm } from "./useNuevoProveedorController.constants";


/**
 * Controller del diálogo de alta de proveedores (wizard 2 pasos).
 * Soporta dos categorías: Logístico (con tipo) y Gasto Operativo (con subtipo_gasto).
 */
export function useNuevoProveedorController(
  onSave: (data: TablesInsert<"proveedores">) => void | Promise<void>,
  onClose: () => void,
  /** Valores iniciales opcionales (p. ej. datos detectados en un CFDI). */
  prefill?: PrefillProveedor,
) {
  const { organizationId } = useOrgFilter();
  const initialForm = useState(() => formInicialProveedor(prefill))[0];
  const [form, setForm] = useState<NuevoProveedorForm>(() => initialForm);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [documentos, setDocumentos] = useState<DocumentoChecklist[]>([]);
  const [csfLoading, setCsfLoading] = useState(false);

  // Verificación de RFC duplicado con debounce + React Query.
  // El debounce evita disparar la query en cada tecla; React Query cachea el
  // resultado por (org, rfc) para no repetir el fetch si el usuario borra y
  // reescribe el mismo RFC.
  const rfcTrimmed = form.rfc.trim();
  const debouncedRfc = useDebouncedValue(rfcTrimmed, 300);
  const rfcCheckQuery = useQuery({
    queryKey: proveedoresKeys.rfcCheck(debouncedRfc, organizationId),
    queryFn: () => findProveedorByRfcEnOrg(debouncedRfc, organizationId as string),
    enabled: !!debouncedRfc && !!organizationId,
    staleTime: 30_000,
    retry: false,
  });
  const rfcDuplicado = rfcCheckQuery.data ?? null;
  const isLogistico = form.categoria === "Logistico";
  const isGasto = form.categoria === "GastoOperativo";
  const isAgenteCarga = isLogistico && form.tipo === "Agente de Carga";
  const rfcLabel = form.origen_proveedor === "Extranjero" ? "Tax ID" : "RFC";

  const isStep1Valid = (): boolean => {

    // Chequeos comunes agrupados en una tabla de aserciones para bajar la
    // complejidad ciclomática (antes 11, ahora 3).
    const camposBase: boolean[] = [
      Boolean(form.categoria),
      Boolean(form.nombre.trim()),
      Boolean(form.origen_proveedor),
      Boolean(form.rfc.trim()),
    ];
    if (camposBase.some((ok) => !ok)) return false;
    // `tipo` es obligatorio para TODO Logístico (nacional y extranjero).
    // El CHECK `proveedores_categoria_check` exige tipo IS NOT NULL cuando
    // categoria='Logistico'; permitir tipo=null aquí producía 23514 en BD.
    if (isLogistico && (!form.tipo || (isAgenteCarga && !form.pais))) return false;
    if (isGasto && !form.subtipo_gasto) return false;
    return true;
  };

  /** YG-06: etiquetas de lo que falta para poder avanzar/guardar el alta. */
  const faltantesStep1 = (): string[] => {
    const items: string[] = [];
    if (!form.categoria) items.push("categoría");
    if (!form.nombre.trim()) items.push("nombre");
    if (!form.origen_proveedor) items.push("origen (nacional/extranjero)");
    if (!form.rfc.trim()) items.push(rfcLabel);
    if (isLogistico && !form.tipo) items.push("tipo de proveedor logístico");
    if (isLogistico && isAgenteCarga && !form.pais) items.push("país");
    if (isGasto && !form.subtipo_gasto) items.push("subtipo de gasto");
    return items;
  };



  const setField = <K extends keyof NuevoProveedorForm>(field: K, value: NuevoProveedorForm[K]) =>
    setForm((prev) => {
      const next = { ...prev, [field]: value } as NuevoProveedorForm;
      // Al cambiar a Nacional, limpiamos `pais` (aplica sólo a Agente de Carga extranjero).
      // `tipo` SÍ se conserva porque también es requerido para Logístico nacional.
      if (field === "origen_proveedor" && value === "Nacional") {
        next.pais = "";
      }
      return next;
    });

  const handleCategoriaChange = (valor: string) => {
    const next = valor as CategoriaProveedor;
    const esGasto = next === "GastoOperativo";
    setForm((prev) => ({
      ...prev,
      categoria: next,
      // Auto-seleccionamos "Naviera" como default para Logístico: evita bloqueo
      // silencioso del wizard (BD exige tipo NOT NULL) y el usuario puede
      // cambiarlo entre Naviera/Aerolínea/Agente de Carga desde el Select.
      tipo: next === "Logistico" ? "Naviera" : null,
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

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm) || documentos.some((d) => d.adjuntado);

  const handleSave = async () => {

    const validacion = preparePayload(form);
    if (!validacion.ok) {
      notifyError(undefined, { title: validacion.mensaje, method: `FEATURES_PROVEEDOR_HOOKS_USENUEVOPROVEEDORCONTROLLER_${validacion.motivo === "clabe" ? 1 : 2}` });
      return;
    }
    setSaving(true);
    try {
      await onSave(validacion.payload);
      reset();
      onClose();
    } catch (err) {
      if (err instanceof ProveedorDuplicadoError) return;
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
    faltantesStep1: faltantesStep1(),
    isDirty,
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
