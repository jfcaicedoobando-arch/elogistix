import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { DocumentoEmbarqueRow } from "@/hooks/embarque";
import { useCreateDocumentoEmbarque } from "@/hooks/embarque";
import { getDocsForMode } from "@/constants/embarqueConstants";
import { useToast } from "@/hooks/shared";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

const OTRO_VALUE = "__otro__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embarqueId: string;
  modo?: string;
  documentos: DocumentoEmbarqueRow[];
}

export function AgregarDocumentoDialog({ open, onOpenChange, embarqueId, modo, documentos }: Props) {
  const { toast } = useToast();
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
      notifyError(toast, { title: "Nombre requerido", description: "Selecciona o escribe el nombre del documento." });
      return;
    }
    try {
      await createDoc.mutateAsync({ embarqueId, nombre: nombreFinal, notas: notasNuevo.trim() || undefined });
      notifySuccess(toast, { title: "Documento agregado" });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      notifyError(toast, { title: "No se pudo agregar el documento", description: getErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar documento</DialogTitle>
          <DialogDescription>
            Crea una nueva entrada en el checklist para luego adjuntar el archivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createDoc.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleCrear} disabled={createDoc.isPending}>
            {createDoc.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
