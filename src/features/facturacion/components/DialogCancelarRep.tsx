/**
 * DialogCancelarRep — Cancela un REP (Complemento de Pagos) timbrado.
 * v13.91.0
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { useCancelarRep } from "@/features/facturacion/hooks/useTimbrarRep";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/repFacturapi";

interface Props {
  pagoId: string | null;
  facturaId?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const MOTIVOS: { value: MotivoCancelacionSat; label: string }[] = [
  { value: "02", label: "02 — Comprobante emitido con errores sin relación" },
  { value: "01", label: "01 — Comprobante emitido con errores con relación (sustituye)" },
  { value: "03", label: "03 — No se llevó a cabo la operación" },
  { value: "04", label: "04 — Operación nominativa relacionada en factura global" },
];

export function DialogCancelarRep({ pagoId, facturaId, open, onOpenChange }: Props) {
  const cancelar = useCancelarRep(facturaId);
  const [motivo, setMotivo] = useState<MotivoCancelacionSat>("02");
  const [sustituye, setSustituye] = useState("");

  if (!pagoId) return null;

  const requiereSustituye = motivo === "01";
  const ok = !requiereSustituye || sustituye.trim().length > 0;

  const onConfirm = () => {
    cancelar.mutate(
      { pagoId, motivo, sustituyeUuid: requiereSustituye ? sustituye.trim() : undefined },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogSize.lg}>
        <DialogHeader>
          <DialogTitle>Cancelar REP</DialogTitle>
          <DialogDescription>
            Selecciona el motivo SAT para cancelar el Complemento de Pagos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Motivo SAT</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoCancelacionSat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {requiereSustituye && (
            <div>
              <Label>UUID del REP que sustituye</Label>
              <Input
                value={sustituye}
                onChange={(e) => setSustituye(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!ok || cancelar.isPending}>
            {cancelar.isPending ? "Cancelando…" : "Cancelar REP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
