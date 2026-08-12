/**
 * Modal para registrar un traspaso entre cuentas propias de banco.
 *
 * La operación genera atómicamente el cargo (origen), abono (destino) y
 * comisión opcional en `bbva_movimientos`, todos auto-conciliados.
 */
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { useRegistrarTraspaso } from "@/features/tesoreria/hooks/useTraspasos";
import { useTraspasoForm } from "@/features/tesoreria/hooks/useTraspasoForm";
import type { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/formatters";

type Cuenta = Tables<"cuentas_bancarias">;

interface DialogTraspasoCuentasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentas: Cuenta[];
}

export function DialogTraspasoCuentas({ open, onOpenChange, cuentas }: DialogTraspasoCuentasProps) {
  const {
    state, setField, origen, destino, mismoMoneda, montoDestino, error,
  } = useTraspasoForm(open, cuentas);
  const { mutate: registrar, isPending } = useRegistrarTraspaso();

  const handleSubmit = () => {
    if (error || isPending) return;
    registrar(
      {
        cuentaOrigenId: state.origenId,
        cuentaDestinoId: state.destinoId,
        fecha: state.fecha,
        montoOrigen: state.montoOrigen,
        tipoCambio: mismoMoneda ? 1 : state.tipoCambio,
        comision: state.comision,
        concepto: state.concepto.trim() || "Traspaso entre cuentas propias",
        referencia: state.referencia.trim(),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ArrowRightLeft}
      title="Traspaso entre cuentas propias"
      description="Registra un movimiento entre tus cuentas del mismo tenant. Se generan los movimientos bancarios conciliados automáticamente."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!!error || isPending}>
            Registrar traspaso
          </Button>
        </>
      }
    >
      <FormDialogSection title="Cuentas" description="Selecciona la cuenta de origen y destino.">
        <CuentaSelect
          id="traspaso-origen"
          label="Cuenta origen"
          cuentas={cuentas}
          value={state.origenId}
          onChange={(v) => setField("origenId", v)}
        />
        <CuentaSelect
          id="traspaso-destino"
          label="Cuenta destino"
          cuentas={cuentas}
          value={state.destinoId}
          onChange={(v) => setField("destinoId", v)}
        />
      </FormDialogSection>

      <FormDialogSection title="Importes y fecha">
        <div className="space-y-1.5">
          <Label htmlFor="traspaso-fecha">Fecha</Label>
          <DatePickerMx id="traspaso-fecha" value={state.fecha} onChange={(v) => setField("fecha", v)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="traspaso-monto">Monto a transferir</Label>
          <MoneyInput
            id="traspaso-monto"
            value={state.montoOrigen}
            onChange={(v) => setField("montoOrigen", v)}
            currency={origen?.moneda}
          />
        </div>
        {!mismoMoneda && origen && destino && (
          <div className="space-y-1.5">
            <Label htmlFor="traspaso-tc">Tipo de cambio</Label>
            <MoneyInput
              id="traspaso-tc"
              value={state.tipoCambio}
              onChange={(v) => setField("tipoCambio", v)}
              placeholder="1.00"
            />
            <p className="text-xs text-muted-foreground">
              {state.tipoCambio > 0
                ? `Estimado con el TC capturado: ${origen.moneda} → ${destino.moneda}: ${formatCurrency(montoDestino, destino.moneda)}`
                : `Captura el tipo de cambio para ver el equivalente en ${destino.moneda}.`}
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="traspaso-comision">Comisión bancaria (opcional)</Label>
          <MoneyInput
            id="traspaso-comision"
            value={state.comision}
            onChange={(v) => setField("comision", v)}
            currency={origen?.moneda}
          />
        </div>
      </FormDialogSection>

      <FormDialogSection title="Detalles" cols={1}>
        <div className="space-y-1.5">
          <Label htmlFor="traspaso-concepto">Concepto</Label>
          <Input
            id="traspaso-concepto"
            value={state.concepto}
            onChange={(e) => setField("concepto", e.target.value)}
            placeholder="Traspaso entre cuentas propias"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="traspaso-referencia">Referencia</Label>
          <Input
            id="traspaso-referencia"
            value={state.referencia}
            onChange={(e) => setField("referencia", e.target.value)}
            placeholder="Referencia del banco"
          />
        </div>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </FormDialogSection>
    </FormDialogShell>
  );
}

function CuentaSelect({
  id, label, cuentas, value, onChange,
}: {
  id: string;
  label: string;
  cuentas: Cuenta[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={`Selecciona ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {cuentas.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.banco} {c.alias} ({c.moneda})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
