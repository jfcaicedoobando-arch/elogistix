import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Upload, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useCreateCliente } from "@/hooks/useClientes";
import { useToast } from "@/hooks/use-toast";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import DocumentChecklist, { type DocumentoChecklist } from "@/components/DocumentChecklist";
import { supabase } from "@/integrations/supabase/client";

const emptyCliente = {
  nombre: "", rfc: "", direccion: "", ciudad: "", estado: "", cp: "", contacto: "", email: "", telefono: "",
};

const DOCS_OBLIGATORIOS = [
  'Constancia de Situación Fiscal (CSF)', 'CIF', 'Opinión fiscal', 'Acta constitutiva',
  'INE RL', 'Poder notarial', 'Comprobante de domicilio', 'Datos bancarios',
  'Opinión de cumplimiento IMSS/Infonavit', 'Contrato de servicios con Elogistix',
  'Estados financieros último corte',
];

type ModoAlta = "manual" | "csf";

type ClienteForm = typeof emptyCliente;

const FORM_FIELDS: { label: string; field: keyof ClienteForm; full?: boolean; required?: boolean }[] = [
  { label: "Nombre / Razón Social", field: "nombre", full: true, required: true },
  { label: "RFC", field: "rfc", required: true },
  { label: "Código Postal", field: "cp", required: true },
  { label: "Dirección", field: "direccion", full: true },
  { label: "Ciudad", field: "ciudad" },
  { label: "Estado", field: "estado" },
  { label: "Contacto", field: "contacto" },
  { label: "Email", field: "email" },
  { label: "Teléfono", field: "telefono" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NuevoClienteDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const createCliente = useCreateCliente();
  const registrarActividad = useRegistrarActividad();

  const [form, setForm] = useState<ClienteForm>(emptyCliente);
  const [step, setStep] = useState<1 | 2>(1);
  const [documentos, setDocumentos] = useState<DocumentoChecklist[]>([]);
  const [modoAlta, setModoAlta] = useState<ModoAlta>("manual");
  const [parsingCsf, setParsingCsf] = useState(false);
  const [csfFile, setCsfFile] = useState<File | null>(null);

  const handleChange = (field: keyof ClienteForm, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const isStep1Valid = () => form.nombre.trim() && form.rfc.trim() && form.cp.trim();

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

  const allDocsAdjuntados = documentos.length > 0 && documentos.every(d => d.adjuntado);

  const handleSave = async () => {
    if (!allDocsAdjuntados) return;
    try {
      const clienteCreado = await createCliente.mutateAsync(form);
      registrarActividad.mutate({
        accion: 'crear', modulo: 'clientes',
        entidad_id: clienteCreado.id, entidad_nombre: clienteCreado.nombre,
      });
      toast({ title: "Cliente creado exitosamente" });
      resetAndClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast({ title: "Error al crear cliente", description: msg, variant: "destructive" });
    }
  };

  const resetAndClose = () => {
    setForm(emptyCliente);
    setStep(1);
    setDocumentos([]);
    setModoAlta("manual");
    setCsfFile(null);
    onOpenChange(false);
  };

  const handleCsfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({ title: "Archivo inválido", description: "Solo se aceptan archivos PDF.", variant: "destructive" });
      return;
    }

    setParsingCsf(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-csf`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al procesar el documento" }));
        throw new Error(err.error || "Error al procesar el documento");
      }

      const datos = await res.json();
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
      toast({ title: "Datos extraídos", description: "Revisa la información antes de continuar." });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast({ title: "Error al leer CSF", description: msg, variant: "destructive" });
    } finally {
      setParsingCsf(false);
      e.target.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(abierto) => { if (!abierto) resetAndClose(); else onOpenChange(abierto); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Cliente — Paso {step} de 2</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Ingresa los datos del nuevo cliente o sube su Constancia de Situación Fiscal (CSF).' : 'Adjunta todos los documentos obligatorios para crear el cliente.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={modoAlta === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setModoAlta("manual")}
              >
                <FileText className="h-4 w-4 mr-1" /> Manual
              </Button>
              <Button
                type="button"
                variant={modoAlta === "csf" ? "default" : "outline"}
                size="sm"
                onClick={() => setModoAlta("csf")}
              >
                <Upload className="h-4 w-4 mr-1" /> Subir CSF
              </Button>
            </div>

            {modoAlta === "csf" && (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center space-y-2">
                {parsingCsf ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Extrayendo datos del CSF…</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Sube la Constancia de Situación Fiscal (PDF) para pre-llenar los datos</p>
                    <label className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>Seleccionar PDF</span>
                      </Button>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={handleCsfUpload}
                      />
                    </label>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {FORM_FIELDS.map(({ label, field, full, required }) => (
                <div key={field} className={full ? "col-span-2" : ""}>
                  <Label className="text-xs">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
                  <Input
                    value={form[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <DocumentChecklist
            documentos={documentos}
            onFileChange={handleFileChange}
            descripcion="Todos los documentos deben estar adjuntados para poder crear el cliente."
          />
        )}

        <DialogFooter>
          {step === 1 && (
            <>
              <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button onClick={handleNext} disabled={!isStep1Valid()}>
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
              </Button>
              <Button onClick={handleSave} disabled={!allDocsAdjuntados || createCliente.isPending}>
                {createCliente.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Crear
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
