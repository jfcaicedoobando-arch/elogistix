/**
 * Ola 2 · O2.6 — cancelar una liquidación aún no pagada. Sus comisiones
 * regresan a `Devengada` para poder re-liquidarse en el periodo correcto.
 */
import { useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { formatCurrency } from "@/lib/formatters";
import { useCancelarLiquidacion } from "@/features/comisiones/hooks";
import type { LiquidacionRow } from "@/features/comisiones/services";

export function DialogCancelarLiquidacion({
  open,
  onOpenChange,
  liq,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  liq: LiquidacionRow | null;
}) {
  const [motivo, setMotivo] = useState("");
  const cancelar = useCancelarLiquidacion();

  if (!liq) return null;

  const handleOpenChange = (o: boolean) => {
    if (!o) setMotivo("");
    onOpenChange(o);
  };

  const submit = () => {
    cancelar.mutate(
      { id: liq.id, motivo: motivo.trim() },
      { onSuccess: () => handleOpenChange(false) },
    );
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={Ban}
      title={`Cancelar liquidación · ${liq.periodo}`}
      description="Las comisiones incluidas volverán a quedar como devengadas y podrás generar una liquidación nueva."
      size="md"
      headerAside={
        <div className="text-right">
          <div className="text-overline">Total</div>
          <div className="text-body-sm font-semibold tabular-nums">
            {formatCurrency(Number(liq.total_mxn), "MXN")}
          </div>
        </div>
      }
      footer={
        <>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={cancelar.isPending}>
            Regresar
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            loading={cancelar.isPending}
            disabled={motivo.trim().length < 5}
          >
            Cancelar liquidación
          </Button>
        </>
      }
    >
      <div className="space-y-1">
        <Label htmlFor="motivo-cancelacion-liquidacion">Motivo de la cancelación</Label>
        <Textarea
          id="motivo-cancelacion-liquidacion"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. se generó con el periodo equivocado"
          rows={3}
        />
        <p className="text-body-sm text-muted-foreground">Mínimo 5 caracteres; queda en la bitácora.</p>
      </div>
    </FormDialogShell>
  );
}
