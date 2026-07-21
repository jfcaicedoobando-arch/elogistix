/**
 * Diálogo de doble confirmación para cancelar una factura de proveedor.
 * Requiere motivo obligatorio + typear CANCELAR. La lógica de reglas
 * (pagos activos, NCs, etc.) vive en la RPC `cancelar_factura_proveedor`.
 *
 * v13.189.0 · Ola 2 · Item 4
 * v13.231.0 · Migrado a `ConfirmActionDialog` (Lote 7d).
 */
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FacturaContextoBand } from "./FacturaContextoBand";
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
    <ConfirmActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      size="md"
      title="Cancelar factura de proveedor"
      titleIcon={<AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />}
      variant="destructive"
      confirmLabel="Cancelar factura"
      cancelLabel="Volver"
      confirmDisabled={!puedeConfirmar}
      isPending={isPending}
      onConfirm={() => onConfirm(motivo.trim())}
      description={
        <div className="space-y-3 text-sm">
          {factura && <FacturaContextoBand factura={factura} variant="compact" emphasis="saldo" />}
          <ul className="list-disc pl-5 text-muted-foreground text-xs space-y-1">
            <li>Las notas de crédito asociadas se cancelarán automáticamente.</li>
            <li>Los conceptos del embarque dejarán de contarla como liquidada.</li>
            <li>No podrás cancelar si la factura tiene pagos aplicados: debes anularlos primero.</li>
            <li>Esta acción no se puede deshacer desde la interfaz.</li>
          </ul>
        </div>
      }
    >
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
    </ConfirmActionDialog>
  );
}
