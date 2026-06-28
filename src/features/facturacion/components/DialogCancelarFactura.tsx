import { useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { MOTIVOS_CANCELACION_SAT } from "@/constants/catalogosSAT";
import { useCancelarFactura } from "@/features/facturacion/hooks/useTimbrarFactura";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";

interface Props {
  facturaId: string | null;
  numero?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function DialogCancelarFactura({ facturaId, numero, open, onOpenChange }: Props) {
  const cancelar = useCancelarFactura();
  const [motivo, setMotivo] = useState<MotivoCancelacionSat>("02");
  const [sustituye, setSustituye] = useState("");

  if (!facturaId) return null;

  const onConfirm = () => {
    cancelar.mutate(
      { facturaId, motivo, sustituyeUuid: motivo === "01" ? sustituye : undefined },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
      <Button
        variant="destructive"
        onClick={onConfirm}
        disabled={cancelar.isPending || (motivo === "01" && !sustituye)}
      >
        {cancelar.isPending ? "Cancelando…" : "Confirmar cancelación"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Ban}
      title={`Cancelar CFDI ${numero ?? ""}`}
      description="La cancelación se enviará al SAT a través de Facturapi. Selecciona el motivo correcto."
      size="lg"
      footer={footer}
    >
      <div className="space-y-2">
        <Label>Motivo SAT</Label>
        <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoCancelacionSat)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MOTIVOS_CANCELACION_SAT.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {motivo === "01" && (
        <div className="space-y-2">
          <Label>UUID que sustituye</Label>
          <Input
            value={sustituye}
            onChange={(e) => setSustituye(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </div>
      )}
    </FormDialogShell>
  );
}
