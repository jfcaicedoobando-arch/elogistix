import { useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import { useCreateCliente } from "@/features/cliente/hooks/useClientes";
import { subirDocumentoCliente } from "@/features/cliente/services/clienteDocumentos";
import type { Cliente } from "@/features/cliente/types/cliente";
import { parseCsf } from "@/features/cliente/services/csf";
import type { DocumentoChecklist } from "@/components/shared/DocumentChecklist";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { isClienteStep1Valid, mergeClienteCsf } from "./nuevoClienteFormState";
import { DOC_CSF, DOCS_OBLIGATORIOS, EMPTY_CLIENTE, type ClienteForm, type ModoAlta } from "./useNuevoClienteController.constants";
export { DOC_CSF, DOCS_OBLIGATORIOS, EMPTY_CLIENTE } from "./useNuevoClienteController.constants";
export type { ClienteForm, ModoAlta } from "./useNuevoClienteController.constants";

/**
 * Controller del diálogo de alta de clientes.
 * Encapsula el estado del wizard de 2 pasos, el parsing de CSF,
 * la validación y la mutación de creación. El componente UI queda presentacional.
 */
export function useNuevoClienteController(onClose: () => void) {
  const createCliente = useCreateCliente();

  const [form, setForm] = useState<ClienteForm>(EMPTY_CLIENTE);
  const [step, setStep] = useState<1 | 2>(1);
  const [modoAlta, setModoAlta] = useState<ModoAlta>("manual");
  const [parsingCsf, setParsingCsf] = useState(false);
  const [csfFile, setCsfFile] = useState<File | null>(null);
  const [csfParsed, setCsfParsed] = useState(false);
  const parseRequest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; parseRequest.current += 1; };
  }, []);
  const [clienteCreado, setClienteCreado] = useState<Cliente | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // El ref bloquea dobles clics y descartes antes del siguiente render.
  const saveInFlight = useRef(false);

  const handleChange = (field: keyof ClienteForm, value: string) =>
    setForm(prev => ({
      ...prev,
      [field]: field === "nombre" ? value.toLocaleUpperCase("es-MX") : value,
    }));

  const isStep1Valid = () => isClienteStep1Valid(form);

  // El archivo seleccionado es la única fuente del checklist, incluso si falla la extracción.
  const documentos: DocumentoChecklist[] = step === 2 ? DOCS_OBLIGATORIOS.map(nombre => ({
    nombre, requerido: nombre === DOC_CSF,
    adjuntado: nombre === DOC_CSF && !!csfFile,
    archivo: nombre === DOC_CSF ? csfFile?.name : undefined,
  })) : [];

  const handleNext = () => {
    if (!isStep1Valid() || parsingCsf) return;
    setStep(2);
  };

  const handleFileChange = (docNombre: string, file: File | undefined) => {
    if (docNombre !== DOC_CSF) return;
    parseRequest.current += 1;
    setParsingCsf(false);
    setCsfParsed(false);
    setCsfFile(file ?? null);
  };

  // P-08: sólo la CSF es obligatoria; el resto del expediente se completa
  // después desde el detalle del cliente.
  const docsRequeridosCompletos =
    documentos.length > 0 && documentos.every(d => d.requerido === false || d.adjuntado);

  const reset = () => {
    setForm(EMPTY_CLIENTE);
    setStep(1);
    parseRequest.current += 1;
    setParsingCsf(false);
    setCsfParsed(false);
    setModoAlta("manual");
    setCsfFile(null);
    setClienteCreado(null);
  };

  const resetAndClose = () => {
    if (saveInFlight.current) return;
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!isStep1Valid() || !docsRequeridosCompletos || !csfFile || saveInFlight.current || parsingCsf) return;
    saveInFlight.current = true;
    setIsSaving(true);
    let cliente = clienteCreado;
    try {
      if (!cliente) {
        cliente = await createCliente.mutateAsync(form);
        if (mounted.current) setClienteCreado(cliente);
      }
      await subirDocumentoCliente({
        clienteId: cliente.id,
        organizationId: cliente.organization_id,
        tipo: "Constancia de situación fiscal",
        archivo: csfFile,
      });
      if (!mounted.current) return;
      notifySuccess(undefined, { title: "Cliente creado exitosamente" });
      // Sólo el guardado exitoso puede cerrar mientras conserva el lock.
      reset();
      onClose();
    } catch (error: unknown) {
      if (!mounted.current) return;
      notifyError(undefined, {
        title: cliente ? "Cliente creado; constancia pendiente" : "Error al crear cliente",
        description: cliente
          ? `La constancia no se guardó. Intenta de nuevo: no se creará otro cliente. ${getErrorMessage(error)}`
          : getErrorMessage(error),
        error: error,
        method: "HANDLE_SAVE",
      });
    } finally {
      saveInFlight.current = false;
      if (mounted.current) setIsSaving(false);
    }
  };

  const handleCsfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf" || file.size > 15 * 1024 * 1024) {
      notifyError(undefined, {
        title: "Archivo inválido",
        description: "Solo se aceptan archivos PDF de hasta 15 MB.",
        method: "HANDLE_CSF_UPLOAD",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }

    const request = ++parseRequest.current;
    setCsfFile(file);
    setCsfParsed(false);
    setParsingCsf(true);
    try {
      const datos = await parseCsf(file);
      if (request !== parseRequest.current) return;
      setForm(prev => mergeClienteCsf(prev, datos));

      setCsfParsed(true);
      notifySuccess(undefined, {
        title: "Datos extraídos",
        description: "Revisa la información antes de continuar."});
    } catch (error: unknown) {
      if (request !== parseRequest.current) return;
      notifyError(undefined, {
        title: "No se pudieron extraer los datos",
        description: `La CSF sigue adjunta. Captura o revisa los datos manualmente. ${getErrorMessage(error)}`,
        error: error,
        method: "HANDLE_CSF_UPLOAD",
      });
    } finally {
      if (request === parseRequest.current) setParsingCsf(false);
    }
  };

  return {
    form,
    step,
    documentos,
    modoAlta,
    parsingCsf,
    csfFile,
    csfParsed,
    clienteCreado,
    isSaving,
    isStep1Valid: isStep1Valid(),
    docsRequeridosCompletos,
    setModoAlta,
    setStep,
    handleChange,
    handleNext,
    handleFileChange,
    handleSave,
    handleCsfUpload,
    resetAndClose,
  };
}
