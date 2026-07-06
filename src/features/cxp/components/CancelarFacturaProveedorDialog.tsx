/**
 * Diálogo de doble confirmación para cancelar una factura de proveedor.
 * Requiere motivo obligatorio. La lógica de reglas (pagos activos, NCs, etc.)
 * vive en la RPC `cancelar_factura_proveedor`.
 *
 * v13.189.0 · Ola 2 · Item 4
 */
import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isPending: boolean;
  onConfirm: (motivo: string) => void | Promise<void>;
}

export function CancelarFacturaProveedorDialog({
  factura, open, onOpenChange, isPending, onConfirm,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const puedeConfirmar = motivo.trim().length >= 4 && confirmText.trim().toUpperCase() === "CANCELAR";

  const handleOpenChange = (o: boolean) => {
    if (!o) { setMotivo(""); setConfirmText(""); }
    onOpenChange(o);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancelar factura de proveedor
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Vas a cancelar la factura <strong>{factura?.folio_proveedor}</strong> de{" "}
                <strong>{factura?.proveedor_nombre}</strong>.
              </p>
              <ul className="list-disc pl-5 text-muted-foreground text-xs space-y-1">
                <li>Las notas de crédito asociadas se cancelarán automáticamente.</li>
                <li>Los conceptos del embarque dejarán de contarla como liquidada.</li>
                <li>No podrás cancelar si la factura tiene pagos aplicados: debes anularlos primero.</li>
                <li>Esta acción no se puede deshacer desde la interfaz.</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cxp-cancel-motivo" className="text-xs">
              Motivo de cancelación <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cxp-cancel-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: CFDI cancelado en el SAT, error de captura, duplicado, etc."
              rows={3}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cxp-cancel-confirm" className="text-xs">
              Escribe <span className="font-mono font-semibold">CANCELAR</span> para confirmar
            </Label>
            <Input
              id="cxp-cancel-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              disabled={isPending}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Volver</AlertDialogCancel>
          <AlertDialogAction
            disabled={!puedeConfirmar || isPending}
            onClick={(e) => {
              e.preventDefault();
              void onConfirm(motivo.trim());
            }}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Cancelar factura
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
