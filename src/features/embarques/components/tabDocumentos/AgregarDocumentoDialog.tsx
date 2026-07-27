import { useMemo, useState } from "react";
import { Loader2, FilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import type { DocumentoEmbarqueRow } from "@/features/embarques/hooks";
import { useCreateDocumentoEmbarque } from "@/features/embarques/hooks";
import { getDocsForMode } from "@/features/embarques/constants/embarqueConstants";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

const OTRO_VALUE = "__otro__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embarqueId: string;
  modo?: string;
  documentos: DocumentoEmbarqueRow[];
}

export function AgregarDocumentoDialog({ open, onOpenChange, embarqueId, modo, documentos }: Props) {
  const [nombreSel, setNombreSel] = useState<string>("");
  const [nombreLibre, setNombreLibre] = useState("");
  const [notasNuevo, setNotasNuevo] = useState("");
  const createDoc = useCreateDocumentoEmbarque();

  const sugerencias = useMemo(() => {
    const ya = new Set(documentos.map((d) => d.nombre));
    return getDocsForMode(modo ?? "").filter((n) => !ya.has(n));
  }, [documentos, modo]);

  const resetForm = () => {
    setNombreSel("");
    setNombreLibre("");
    setNotasNuevo("");
  };

  const handleCrear = async () => {
    const nombreFinal = nombreSel === OTRO_VALUE ? nombreLibre.trim() : nombreSel.trim();
    if (!nombreFinal) {
      notifyError(undefined, { title: "Nombre requerido", description: "Selecciona o escribe el nombre del documento.", method: "HANDLE_CREAR", errorCode: ERROR_CODES.VALIDATION_FAILED });
      return;
    }
    try {
      await createDoc.mutateAsync({ embarqueId, nombre: nombreFinal, notas: notasNuevo.trim() || undefined });
      notifySuccess(undefined, { title: "Documento agregado" });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      notifyError(undefined, { title: "No se pudo agregar el documento", description: getErrorMessage(err), error: err, method: "HANDLE_CREAR" });
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}
      icon={FilePlus}
      title="Agregar documento"
      description="Crea una nueva entrada en el checklist para luego adjuntar el archivo."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createDoc.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleCrear} disabled={createDoc.isPending}>
            {createDoc.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Agregar
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="doc-nombre">Tipo de documento</Label>
        <Select value={nombreSel} onValueChange={setNombreSel}>
          <SelectTrigger id="doc-nombre">
            <SelectValue placeholder="Selecciona un documento estándar" />
          </SelectTrigger>
          <SelectContent>
            {sugerencias.map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
            <SelectItem value={OTRO_VALUE}>Otro (nombre personalizado)…</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {nombreSel === OTRO_VALUE && (
        <div className="space-y-1.5">
          <Label htmlFor="doc-nombre-libre">Nombre personalizado</Label>
          <Input
            id="doc-nombre-libre"
            value={nombreLibre}
            onChange={(e) => setNombreLibre(e.target.value)}
            placeholder="Ej. Pedimento, Certificado fitosanitario…"
            maxLength={120}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="doc-notas">Notas (opcional)</Label>
        <Textarea
          id="doc-notas"
          value={notasNuevo}
          onChange={(e) => setNotasNuevo(e.target.value)}
          placeholder="Referencias, instrucciones, etc."
          rows={3}
        />
      </div>
    </FormDialogShell>
  );
}
