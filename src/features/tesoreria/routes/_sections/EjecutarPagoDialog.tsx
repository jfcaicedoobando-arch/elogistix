/**
 * Diálogo "Ejecutar pago" de la bandeja de pagos programados.
 * Extraído de `TesoreriaPagosProgramados` para bajar su tamaño/complejidad.
 */
import { Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { formatCurrency } from "@/lib/formatters";

import type { FacturaProgramable } from "@/features/tesoreria/domain/pagosProgramados";
import type { CuentaBancaria } from "@/features/tesoreria/services";

export interface FormPago {
  cuentaBancariaId: string;
  fecha: string;
  monto: number;
  metodoPago: string;
  referencia: string;
}

interface Props {
  facturaPago: FacturaProgramable | null;
  onClose: () => void;
  cuentasCompatibles: CuentaBancaria[];
  form: FormPago;
  setField: <K extends keyof FormPago>(key: K, value: FormPago[K]) => void;
  onEjecutar: () => void;
  isPending: boolean;
}

const FORM_ID = "form-ejecutar-pago";

export function EjecutarPagoDialog({
  facturaPago, onClose, cuentasCompatibles, form, setField, onEjecutar, isPending,
}: Props) {
  const puedeEjecutar =
    !!facturaPago && !!form.cuentaBancariaId && !!form.fecha && form.monto > 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!puedeEjecutar || isPending) return;
    onEjecutar();
  };

  return (
    <FormDialogShell
      open={!!facturaPago}
      onOpenChange={(v) => { if (!v) onClose(); }}
      icon={Wallet}
      title="Ejecutar pago programado"
      description={
        facturaPago
          ? `${facturaPago.proveedor_nombre ?? "Proveedor"} · Saldo ${formatCurrency(facturaPago.saldo, facturaPago.moneda)}`
          : undefined
      }
      formId={FORM_ID}
      onSubmit={handleSubmit}
      bodyClassName="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:space-y-0"
      footer={
        <FormDialogFooter
          formId={FORM_ID}
          onCancel={onClose}
          confirmLabel="Ejecutar pago"
          loadingLabel="Ejecutando..."
          loading={isPending}
          disabled={!puedeEjecutar || isPending}
        />
      }
    >
      <div className="sm:col-span-2">
        <Label htmlFor="pago-cuenta">Cuenta bancaria *</Label>
        <Select value={form.cuentaBancariaId} onValueChange={(v) => setField("cuentaBancariaId", v)}>
          <SelectTrigger id="pago-cuenta"><SelectValue placeholder="Selecciona cuenta..." /></SelectTrigger>
          <SelectContent>
            {cuentasCompatibles.length === 0
              ? <SelectItem value="__sin" disabled>Sin cuentas en {facturaPago?.moneda}</SelectItem>
              : cuentasCompatibles.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.banco} · {c.alias} ({c.moneda})</SelectItem>
              ))
            }
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="pago-fecha">Fecha *</Label>
        <DatePickerMx id="pago-fecha" value={form.fecha} onChange={(v) => setField("fecha", v)} className="w-full" />
      </div>

      <div>
        <Label htmlFor="pago-monto">Monto *</Label>
        <MoneyInput
          id="pago-monto"
          value={form.monto}
          onChange={(n: number) => setField("monto", n)}
          currency={facturaPago?.moneda}
          aria-invalid={form.monto <= 0}
        />
      </div>
      <div>
        <Label htmlFor="pago-metodo">Método de pago</Label>
        <Select value={form.metodoPago} onValueChange={(v) => setField("metodoPago", v)}>
          <SelectTrigger id="pago-metodo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Transferencia">Transferencia</SelectItem>
            <SelectItem value="Cheque">Cheque</SelectItem>
            <SelectItem value="Efectivo">Efectivo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="pago-referencia">Referencia</Label>
        <Input id="pago-referencia" value={form.referencia} onChange={(e) => setField("referencia", e.target.value)} />
        </div>
    </FormDialogShell>
  );
}
