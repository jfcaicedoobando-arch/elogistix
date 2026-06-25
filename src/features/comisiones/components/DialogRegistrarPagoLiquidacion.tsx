import { useState } from "react";
import { Loader2, BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { formatCurrency } from "@/lib/formatters";
import { useRegistrarPagoLiquidacion } from "@/features/comisiones/hooks";
import type { LiquidacionRow } from "@/features/comisiones/services";


export function DialogRegistrarPagoLiquidacion({
  open, onOpenChange, liq,
}: { open: boolean; onOpenChange: (o: boolean) => void; liq: LiquidacionRow | null }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState("Transferencia");
  const [referencia, setReferencia] = useState("");
  const reg = useRegistrarPagoLiquidacion();

  if (!liq) return null;

  // 13.85.10 — Toasts viven en `useRegistrarPagoLiquidacion`. Aquí sólo cerramos el dialog.
  const submit = () => {
    reg.mutate(
      { id: liq.id, fecha_pago: fecha, metodo_pago: metodo, referencia },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={BadgeDollarSign}
      title={`Registrar pago de liquidación · ${liq.periodo}`}
      description="Registra el pago de la liquidación de comisiones del período seleccionado."
      size="lg"
      headerAside={
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total a pagar</div>
          <div className="text-sm font-semibold tabular-nums">{formatCurrency(Number(liq.total_mxn), "MXN")}</div>
        </div>
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={reg.isPending}>
            {reg.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Registrar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Fecha</Label>
          <DatePickerMx value={fecha} onChange={setFecha} className="w-full" />
        </div>
        <div className="space-y-1">
          <Label>Método</Label>
          <Select value={metodo} onValueChange={setMetodo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Transferencia">Transferencia</SelectItem>
              <SelectItem value="Cheque">Cheque</SelectItem>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Referencia</Label>
        <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="No. operación o cheque" />
      </div>
    </FormDialogShell>
  );
}
