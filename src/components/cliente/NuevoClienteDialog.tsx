import { ArrowLeft, ArrowRight, Loader2, Upload, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import DocumentChecklist from "@/components/DocumentChecklist";
import {
  useNuevoClienteController,
  type ClienteForm,
} from "@/hooks/cliente/useNuevoClienteController";

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
  const c = useNuevoClienteController(() => onOpenChange(false));

  return (
    <Dialog
      open={open}
      onOpenChange={(abierto) => {
        if (!abierto) c.resetAndClose();
        else onOpenChange(abierto);
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Cliente — Paso {c.step} de 2</DialogTitle>
          <DialogDescription>
            {c.step === 1
              ? 'Ingresa los datos del nuevo cliente o sube su Constancia de Situación Fiscal (CSF).'
              : 'Adjunta todos los documentos obligatorios para crear el cliente.'}
          </DialogDescription>
        </DialogHeader>

        {c.step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button type="button" variant={c.modoAlta === "manual" ? "default" : "outline"} size="sm" onClick={() => c.setModoAlta("manual")}>
                <FileText className="h-4 w-4 mr-1" /> Manual
              </Button>
              <Button type="button" variant={c.modoAlta === "csf" ? "default" : "outline"} size="sm" onClick={() => c.setModoAlta("csf")}>
                <Upload className="h-4 w-4 mr-1" /> Subir CSF
              </Button>
            </div>

            {c.modoAlta === "csf" && (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center space-y-2">
                {c.parsingCsf ? (
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
                      <input type="file" accept="application/pdf" className="hidden" onChange={c.handleCsfUpload} />
                    </label>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {FORM_FIELDS.map(({ label, field, full, required }) => (
                <div key={field} className={full ? "col-span-2" : ""}>
                  <Label className="text-xs">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
                  <Input value={c.form[field]} onChange={(e) => c.handleChange(field, e.target.value)} className="mt-1" />
                </div>
              ))}
            </div>
          </div>
        )}

        {c.step === 2 && (
          <DocumentChecklist
            documentos={c.documentos}
            onFileChange={c.handleFileChange}
            descripcion="Todos los documentos deben estar adjuntados para poder crear el cliente."
          />
        )}

        <DialogFooter>
          {c.step === 1 && (
            <>
              <Button variant="outline" onClick={c.resetAndClose}>Cancelar</Button>
              <Button onClick={c.handleNext} disabled={!c.isStep1Valid}>
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {c.step === 2 && (
            <>
              <Button variant="outline" onClick={() => c.setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
              </Button>
              <Button onClick={c.handleSave} disabled={!c.allDocsAdjuntados || c.isSaving}>
                {c.isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Crear
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
