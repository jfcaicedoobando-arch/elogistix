/**
 * Dialog post-guardado del wizard de cotización (P0 — v13.293.0).
 * Presenta al usuario 4 acciones claras después de crear/actualizar una
 * cotización, en vez de dejarlo huérfano en la pantalla de detalle.
 */
import { CheckCircle2, Send, Copy, Truck, List, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folio?: string | null;
  onEnviarProforma: () => void;
  onDuplicar: () => void;
  onCrearEmbarque: () => void;
  onIrAlListado: () => void;
  onVerDetalle: () => void;
  /** P2 (v13.295.0) — opcional; si se pasa, muestra "Guardar como plantilla". */
  onGuardarComoPlantilla?: () => void;
}


export function CotizacionSuccessDialog({
  open, onOpenChange, folio,
  onEnviarProforma, onDuplicar, onCrearEmbarque, onIrAlListado, onVerDetalle,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 mb-2">
            <CheckCircle2 className="h-6 w-6 [color:hsl(var(--success))]" aria-hidden />
          </div>
          <DialogTitle className="text-center">Cotización guardada</DialogTitle>
          <DialogDescription className="text-center">
            {folio ? <>Folio <span className="font-semibold">{folio}</span>. ¿Qué sigue?</> : "¿Qué sigue?"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <Button variant="default" onClick={onEnviarProforma} className="justify-start">
            <Send className="h-4 w-4 mr-2" /> Enviar proforma
          </Button>
          <Button variant="outline" onClick={onCrearEmbarque} className="justify-start">
            <Truck className="h-4 w-4 mr-2" /> Crear embarque
          </Button>
          <Button variant="outline" onClick={onDuplicar} className="justify-start">
            <Copy className="h-4 w-4 mr-2" /> Duplicar
          </Button>
          <Button variant="outline" onClick={onIrAlListado} className="justify-start">
            <List className="h-4 w-4 mr-2" /> Ver listado
          </Button>
        </div>

        <div className="pt-1">
          <Button variant="ghost" onClick={onVerDetalle} className="w-full text-sm">
            Ir al detalle de la cotización
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
