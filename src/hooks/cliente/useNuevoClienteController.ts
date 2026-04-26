import { useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/hooks/use-toast";
import { useCreateCliente } from "@/hooks/useClientes";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { parseCsf } from "@/services/csfService";
import type { DocumentoChecklist } from "@/components/DocumentChecklist";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export const EMPTY_CLIENTE = {
  nombre: "", rfc: "", direccion: "", ciudad: "", estado: "", cp: "", contacto: "", email: "", telefono: "",
};

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
  const { toast } = useToast();
  const createCliente = useCreateCliente();
  const registrarActividad = useRegistrarActividad();

  const [form, setForm] = useState<ClienteForm>(EMPTY_CLIENTE);
  const [step, setStep] = useState<1 | 2>(1);
  const [documentos, setDocumentos] = useState<DocumentoChecklist[]>([]);
  const [modoAlta, setModoAlta] = useState<ModoAlta>("manual");
  const [parsingCsf, setParsingCsf] = useState(false);
  const [csfFile, setCsfFile] = useState<File | null>(null);

  const handleChange = (field: keyof ClienteForm, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const isStep1Valid = () =>
    Boolean(form.nombre.trim() && form.rfc.trim() && form.cp.trim());

  const handleNext = () => {
    if (!isStep1Valid()) return;
    setDocumentos(DOCS_OBLIGATORIOS.map(nombre => {
      if (nombre === 'Constancia de Situación Fiscal (CSF)' && csfFile) {
        return { nombre, adjuntado: true, archivo: csfFile.name };
      }
      return { nombre, adjuntado: false };
    }));
    setStep(2);
  };

  const handleFileChange = (docNombre: string, file: File | undefined) => {
    setDocumentos(prev =>
      prev.map(d => d.nombre === docNombre ? { ...d, archivo: file?.name, adjuntado: !!file } : d)
    );
  };

  const allDocsAdjuntados =
    documentos.length > 0 && documentos.every(d => d.adjuntado);

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
    if (!allDocsAdjuntados) return;
    try {
      const clienteCreado = await createCliente.mutateAsync(form);
      registrarActividad.mutate({
        accion: 'crear', modulo: 'clientes',
        entidad_id: clienteCreado.id, entidad_nombre: clienteCreado.nombre,
      });
      notifySuccess(toast, { title: "Cliente creado exitosamente" });
      resetAndClose();
    } catch (error: unknown) {
      notifyError(toast, { title: "Error al crear cliente",
        message: getErrorMessage(error) });
    }
  };

  const handleCsfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      notifyError(toast, { title: "Archivo inválido",
        message: "Solo se aceptan archivos PDF." });
      return;
    }

    setParsingCsf(true);
    try {
      const datos = await parseCsf(file);
      setForm(prev => ({
        ...prev,
        nombre: datos.nombre || prev.nombre,
        rfc: datos.rfc || prev.rfc,
        cp: datos.cp || prev.cp,
        direccion: datos.direccion || prev.direccion,
        ciudad: datos.ciudad || prev.ciudad,
        estado: datos.estado || prev.estado,
      }));

      setCsfFile(file);
      notifySuccess(toast, {
        title: "Datos extraídos",
        description: "Revisa la información antes de continuar.",
      });
    } catch (error: unknown) {
      notifyError(toast, { title: "Error al leer CSF",
        message: getErrorMessage(error) });
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
    isSaving: createCliente.isPending,
    isStep1Valid: isStep1Valid(),
    allDocsAdjuntados,
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
