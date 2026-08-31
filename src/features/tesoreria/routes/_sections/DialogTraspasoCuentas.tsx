/**
 * Modal para registrar un traspaso entre cuentas propias de banco.
 *
 * La operación genera atómicamente el cargo (origen), abono (destino) y
 * comisión opcional en `bbva_movimientos`, todos auto-conciliados.
 */
import { useEffect, useRef } from "react";
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
import { etiquetaTc } from "@/features/tesoreria/domain/tcPar";

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
    state, setField, origen, destino, mismoMoneda, par, factorOrigenDestino, montoDestino, error, fechaTcDof,
  } = useTraspasoForm(open, cuentas);
  const { mutate: registrar, isPending } = useRegistrarTraspaso();

  // OLA A (A.1): un UUID por apertura del diálogo. Todos los reintentos del
  // MISMO submit comparten la clave y el UNIQUE parcial de BD absorbe el
  // duplicado (doble clic o retry de red tras timeout).
  const clientRequestIdRef = useRef<string | null>(null);
  useEffect(() => {
    clientRequestIdRef.current = open ? crypto.randomUUID() : null;
  }, [open]);

  // BL-04: la RPC recibe el multiplicador origen→destino. El usuario captura
  // la cotización a la mexicana (pesos por dólar) y aquí se deriva el factor.
  const tipoCambioFinal = mismoMoneda ? 1 : (factorOrigenDestino ?? 0);
  const bloqueado = !!error || isPending || !(tipoCambioFinal > 0);

  // YG-04: hay datos capturados que se perderían al cerrar el modal.
  const isDirty =
    !!state.origenId || !!state.destinoId || state.montoOrigen > 0 ||
    state.comision > 0 || state.concepto.trim() !== "" || state.referencia.trim() !== "";


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
        clientRequestId: clientRequestIdRef.current,
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
      isDirty={isDirty}
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
        {!mismoMoneda && origen && destino && par && (
          <div className="space-y-1.5">
            <Label htmlFor="traspaso-tc">{etiquetaTc(par)} *</Label>
            <MoneyInput
              id="traspaso-tc"
              value={state.tcQuote}
              onChange={(v) => setField("tcQuote", v)}
              placeholder={par.quote === "MXN" ? "18.4200" : "1.0800"}
            />
            {state.tcQuote > 0 ? (
              <p className="text-body-sm text-muted-foreground">
                {`1 ${par.base} = ${state.tcQuote} ${par.quote}. Traspasas ${formatCurrency(state.montoOrigen, origen.moneda)} y se abonan ${formatCurrency(montoDestino, destino.moneda)}.`}
              </p>
            ) : (
              <p className="text-body-sm text-destructive" role="alert">
                Captura el tipo de cambio: es obligatorio porque las cuentas son de distinta moneda.
              </p>
            )}
            {fechaTcDof && (
              <p className="text-body-sm text-muted-foreground">
                Sugerido con el TC DOF publicado el {fechaTcDof}. Puedes editarlo si tu banco usó otro.
              </p>
            )}
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
          <p className="text-body-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </FormDialogSection>
    </FormDialogShell>
  );
}
