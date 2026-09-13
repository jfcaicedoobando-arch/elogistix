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
import { dialogSize } from "@/components/shared/utils/dialogTokens";

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
  /**
   * R215-COT-01: estado real de la cotización guardada. Sólo `Aceptada` (o
   * `En operación`) puede iniciar la conversión a embarque; en Borrador el
   * backend la rechaza al final del asistente, así que ni se ofrece.
   */
  estado?: string | null;
  /**
   * Capability `CREAR_EMBARQUE_DESDE_COTIZACION` (espejo de
   * `crear_embarque_borrador_core`). Sin ella el diálogo no ofrece el atajo:
   * el backend rechazaría la creación con 42501.
   */
  puedeCrearEmbarqueRol?: boolean;
}

const ESTADOS_CONVERTIBLES = ["Aceptada", "En operación"];

export function CotizacionSuccessDialog({
  open, onOpenChange, folio,
  onEnviarProforma, onDuplicar, onCrearEmbarque, onIrAlListado, onVerDetalle,
  onGuardarComoPlantilla, estado, puedeCrearEmbarqueRol = false,
}: Props) {
  const puedeCrearEmbarque =
    puedeCrearEmbarqueRol && ESTADOS_CONVERTIBLES.includes(String(estado ?? ""));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogSize.md}>
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
          {puedeCrearEmbarque ? (
            <Button variant="outline" onClick={onCrearEmbarque} className="justify-start">
              <Truck className="h-4 w-4 mr-2" /> Crear embarque
            </Button>
          ) : (
            <Button variant="outline" onClick={onVerDetalle} className="justify-start">
              <Truck className="h-4 w-4 mr-2" /> Ver cotización y aceptar
            </Button>
          )}
          <Button variant="outline" onClick={onDuplicar} className="justify-start">
            <Copy className="h-4 w-4 mr-2" /> Duplicar
          </Button>
          <Button variant="outline" onClick={onIrAlListado} className="justify-start">
            <List className="h-4 w-4 mr-2" /> Ver listado
          </Button>
        </div>

        {!puedeCrearEmbarque && (
          <p className="pt-1 text-center text-label text-muted-foreground">
            El embarque se genera cuando el cliente acepta la cotización.
          </p>
        )}

        {onGuardarComoPlantilla && (
          <div className="pt-1">
            <Button variant="ghost" onClick={onGuardarComoPlantilla} className="w-full text-body">
              <BookmarkPlus className="h-4 w-4 mr-2" /> Guardar como plantilla
            </Button>
          </div>
        )}

        <div className="pt-1">
          <Button variant="ghost" onClick={onVerDetalle} className="w-full text-body">
            Ir al detalle de la cotización
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

