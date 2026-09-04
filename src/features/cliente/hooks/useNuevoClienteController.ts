import { useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import { useCreateCliente } from "@/features/cliente/hooks/useClientes";
import { useRegistrarActividad } from "@/hooks/shared";
import { parseCsf } from "@/features/cliente/services/csf";
import type { DocumentoChecklist } from "@/components/shared/DocumentChecklist";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { normalizarRazonSocial } from "@/lib/text/razonSocial";
import { emailLooksValid } from "@/features/cliente/components/nuevoClienteValidators";
export const EMPTY_CLIENTE = {
  nombre: "", rfc: "", direccion: "", ciudad: "", estado: "", cp: "", contacto: "", email: "", telefono: "",
  // O4.6: pre-flight fiscal — capturamos los defaults de pago desde el alta
  // para que el timbrado nunca se detenga por datos faltantes.
  regimen_fiscal: "", uso_cfdi_default: "G03", forma_pago_default: "99", metodo_pago_default: "PPD",
};

/** Único documento indispensable para dar de alta al cliente. */
export const DOC_CSF = 'Constancia de Situación Fiscal (CSF)';

/** Checklist completo del expediente; sólo la CSF bloquea el alta. */
export const DOCS_OBLIGATORIOS = [
  'Constancia de Situación Fiscal (CSF)', 'CIF', 'Opinión fiscal', 'Acta constitutiva',
  'INE RL', 'Poder notarial', 'Comprobante de domicilio', 'Datos bancarios',
  'Opinión de cumplimiento IMSS/Infonavit', 'Contrato de servicios con Libre Carga',
  'Estados financieros último corte',
];

export type ModoAlta = "manual" | "csf";
export type ClienteForm = typeof EMPTY_CLIENTE;

/**
 * Controller del diálogo de alta de clientes.
 * Encapsula el estado del wizard de 2 pasos, el parsing de CSF,
 * la validación y la mutación de creación. El componente UI queda presentacional.
 */
export function useNuevoClienteController(onClose: () => void) {
  const createCliente = useCreateCliente();
  const registrarActividad = useRegistrarActividad();

  const [form, setForm] = useState<ClienteForm>(EMPTY_CLIENTE);
  const [step, setStep] = useState<1 | 2>(1);
  const [documentos, setDocumentos] = useState<DocumentoChecklist[]>([]);
  const [modoAlta, setModoAlta] = useState<ModoAlta>("manual");
  const [parsingCsf, setParsingCsf] = useState(false);
  const [csfFile, setCsfFile] = useState<File | null>(null);

  const handleChange = (field: keyof ClienteForm, value: string) =>
    setForm(prev => ({
      ...prev,
      [field]: field === "nombre" ? value.toLocaleUpperCase("es-MX") : value,
    }));

  // B-024 · email/teléfono/contacto son NOT NULL en BD (trigger NULLIF('')→NULL
  // provocaba 23502 crudo). Los exigimos aquí para bloquear el paso 1.
  // v13.823.77 — el correo además debe tener forma válida: antes "Siguiente"
  // avanzaba con "qa.cliente@" y el alta fallaba al final.
  const isStep1Valid = () =>
    Boolean(
      form.nombre.trim() &&
      form.rfc.trim() &&
      form.cp.trim() &&
      form.regimen_fiscal.trim() &&
      form.uso_cfdi_default.trim() &&
      form.forma_pago_default.trim() &&
      form.metodo_pago_default.trim() &&
      emailLooksValid(form.email) &&
      form.telefono.trim() &&
      form.contacto.trim()
    );



  const handleNext = () => {
    if (!isStep1Valid()) return;
    setDocumentos(DOCS_OBLIGATORIOS.map(nombre => {
      const requerido = nombre === DOC_CSF;
      if (requerido && csfFile) {
        return { nombre, adjuntado: true, archivo: csfFile.name, requerido };
      }
      return { nombre, adjuntado: false, requerido };
    }));
    setStep(2);
  };

  const handleFileChange = (docNombre: string, file: File | undefined) => {
    setDocumentos(prev =>
      prev.map(d => d.nombre === docNombre ? { ...d, archivo: file?.name, adjuntado: !!file } : d)
    );
  };

  // P-08: sólo la CSF es obligatoria; el resto del expediente se completa
  // después desde el detalle del cliente.
  const docsRequeridosCompletos =
    documentos.length > 0 && documentos.every(d => d.requerido === false || d.adjuntado);

  const reset = () => {
    setForm(EMPTY_CLIENTE);
    setStep(1);
    setDocumentos([]);
    setModoAlta("manual");
    setCsfFile(null);
  };

  const resetAndClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!docsRequeridosCompletos) return;
    try {
      const clienteCreado = await createCliente.mutateAsync(form);
      registrarActividad.mutate({
        accion: 'crear', modulo: 'clientes',
        entidad_id: clienteCreado.id, entidad_nombre: clienteCreado.nombre,
      });
      notifySuccess(undefined, { title: "Cliente creado exitosamente" });
      resetAndClose();
    } catch (error: unknown) {
      notifyError(undefined, {
        title: "Error al crear cliente",
        description: getErrorMessage(error),
        error: error,
        method: "HANDLE_SAVE",
      });
    }
  };

  const handleCsfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      notifyError(undefined, {
        title: "Archivo inválido",
        description: "Solo se aceptan archivos PDF.",
        method: "HANDLE_CSF_UPLOAD",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      return;
    }

    setParsingCsf(true);
    try {
      const datos = await parseCsf(file);
      setForm(prev => ({
        ...prev,
        nombre: normalizarRazonSocial(datos.nombre) || prev.nombre,

        rfc: datos.rfc || prev.rfc,
        cp: datos.cp || prev.cp,
        direccion: datos.direccion || prev.direccion,
        ciudad: datos.ciudad || prev.ciudad,
        estado: datos.estado || prev.estado,
        regimen_fiscal: datos.regimen_fiscal || prev.regimen_fiscal,
      }));

      setCsfFile(file);
      notifySuccess(undefined, {
        title: "Datos extraídos",
        description: "Revisa la información antes de continuar."});
    } catch (error: unknown) {
      notifyError(undefined, {
        title: "Error al leer CSF",
        description: getErrorMessage(error),
        error: error,
        method: "HANDLE_CSF_UPLOAD",
      });
    } finally {
      setParsingCsf(false);
      e.target.value = "";
    }
  };

  return {
    form,
    step,
    documentos,
    modoAlta,
    parsingCsf,
    csfFile,
    isSaving: createCliente.isPending,
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

