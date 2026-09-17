/**
 * Modal para registrar un traspaso entre cuentas propias de banco.
 *
 * La operación genera atómicamente el cargo (origen), abono (destino) y
 * comisión opcional en `bbva_movimientos`, todos auto-conciliados.
 */
import { useEffect } from "react";
import { ArrowRightLeft } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TraspasoCuentaSelect } from "./TraspasoCuentaSelect";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { FormDialogSection } from "@/components/shared/FormDialogSection";

import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { TraspasoConversion } from "./TraspasoConversion";
import { useRegistrarTraspaso } from "@/features/tesoreria/hooks/useTraspasos";
import {
  useTraspasoForm, traspasoSucio, partesTraspaso, conceptoTraspaso,
} from "@/features/tesoreria/hooks/useTraspasoForm";

import { usePayloadRequestId, scopeDePayload } from "@/lib/idempotency";
import type { Tables } from "@/integrations/supabase/types";



type Cuenta = Tables<"cuentas_bancarias">;

interface DialogTraspasoCuentasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentas: Cuenta[];
}

const FORM_ID = "form-traspaso-cuentas";

export function DialogTraspasoCuentas({ open, onOpenChange, cuentas }: DialogTraspasoCuentasProps) {
  const {
    state, setField, origen, destino, mismoMoneda, par, factorOrigenDestino, montoDestino, error, fechaTcDof, tcEsManual,
  } = useTraspasoForm(open, cuentas);
  const { mutate: registrar, isPending } = useRegistrarTraspaso();

  // OLA A (A.1) + MNY: la clave se liga al CONTENIDO del traspaso. Reintentar
  // el mismo traspaso comparte la clave y el UNIQUE parcial de BD absorbe el
  // duplicado (doble clic / retry tras timeout); si el usuario cambia cuentas,
  // fecha o importes, la clave cambia y no se confirma el traspaso anterior.
  const clientRequestId = usePayloadRequestId();
  useEffect(() => {
    if (!open) clientRequestId.reset();
  }, [open, clientRequestId]);

  // BL-04: la RPC recibe el multiplicador origen→destino. El usuario captura
  // la cotización a la mexicana (pesos por dólar) y aquí se deriva el factor.
  const tipoCambioFinal = mismoMoneda ? 1 : (factorOrigenDestino ?? 0);
  const bloqueado = !!error || isPending || !(tipoCambioFinal > 0);

  // YG-04: hay datos capturados que se perderían al cerrar el modal.
  const isDirty = traspasoSucio(state);

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
        concepto: conceptoTraspaso(state),
        referencia: state.referencia.trim(),
        clientRequestId: clientRequestId.get(
          scopeDePayload(partesTraspaso(state, tipoCambioFinal)),
        ),
      },

      {
        onSuccess: () => {
          clientRequestId.reset();
          onOpenChange(false);
        },
      },
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

      {origen && destino && (
        <TraspasoConversion
          monedaOrigen={origen.moneda}
          monedaDestino={destino.moneda}
          mismoMoneda={!!mismoMoneda}
          par={par}
          tcQuote={state.tcQuote}
          onTcQuoteChange={(v) => setField("tcQuote", v)}
          montoOrigen={state.montoOrigen}
          comision={state.comision}
          montoDestino={montoDestino}
          fechaTcDof={fechaTcDof}
          tcEsManual={tcEsManual}

        />
      )}



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
