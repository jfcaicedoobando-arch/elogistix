/**
 * Modal para registrar un traspaso entre cuentas propias de banco.
 *
 * La operación genera atómicamente el cargo (origen), abono (destino) y
 * comisión opcional en `bbva_movimientos`, todos auto-conciliados.
 */
import { ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TraspasoCuentaSelect } from "./TraspasoCuentaSelect";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
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

const FORM_ID = "form-traspaso-cuentas";

export function DialogTraspasoCuentas({ open, onOpenChange, cuentas }: DialogTraspasoCuentasProps) {
  const {
    state, setField, origen, destino, mismoMoneda, montoDestino, error, fechaTcDof,
  } = useTraspasoForm(open, cuentas);
  const { mutate: registrar, isPending } = useRegistrarTraspaso();

  // BL-04: sólo se manda 1 cuando ambas cuentas comparten moneda. Si difieren,
  // el TC capturado es obligatorio (la validación ya bloquea el botón).
  const tipoCambioFinal = mismoMoneda ? 1 : state.tipoCambio;
  const bloqueado = !!error || isPending || !(tipoCambioFinal > 0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (bloqueado) return;
    registrar(
      {
        cuentaOrigenId: state.origenId,
        cuentaDestinoId: state.destinoId,
        fecha: state.fecha,
        montoOrigen: state.montoOrigen,
        tipoCambio: tipoCambioFinal,
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
      formId={FORM_ID}
      onSubmit={handleSubmit}
      footer={
        <FormDialogFooter
          formId={FORM_ID}
          onCancel={() => onOpenChange(false)}
          confirmLabel="Registrar traspaso"
          loading={isPending}
          disabled={bloqueado}
        />
      }
    >
      <FormDialogSection title="Cuentas" description="Selecciona la cuenta de origen y destino.">

        <TraspasoCuentaSelect
          id="traspaso-origen"
          label="Cuenta origen"
          cuentas={cuentas}
          value={state.origenId}
          onChange={(v) => setField("origenId", v)}
        />
        <TraspasoCuentaSelect
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
            <Label htmlFor="traspaso-tc">Tipo de cambio *</Label>
            <MoneyInput
              id="traspaso-tc"
              value={state.tipoCambio}
              onChange={(v) => setField("tipoCambio", v)}
              placeholder="1.00"
            />
            {state.tipoCambio > 0 ? (
              <p className="text-xs text-muted-foreground">
                {`Estimado con el TC capturado: ${origen.moneda} → ${destino.moneda}: ${formatCurrency(montoDestino, destino.moneda)}`}
              </p>
            ) : (
              <p className="text-xs text-destructive" role="alert">
                Captura el tipo de cambio: es obligatorio porque las cuentas son de distinta moneda.
              </p>
            )}
            {fechaTcDof && (
              <p className="text-xs text-muted-foreground">
                Sugerido con el TC DOF publicado el {fechaTcDof}. Puedes editarlo si tu banco usó otro.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              El tipo de cambio multiplica: 1 {origen.moneda} = {state.tipoCambio || "?"} {destino.moneda}.
              Si tu referencia viene expresada al revés, divídela antes de capturarla.
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
