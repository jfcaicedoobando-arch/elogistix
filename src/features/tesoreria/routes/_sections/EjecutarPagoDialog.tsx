/**
 * Diálogo "Ejecutar pago" de la bandeja de pagos programados.
 * Extraído de `TesoreriaPagosProgramados` para bajar su tamaño/complejidad.
 */
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
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

export function EjecutarPagoDialog({
  facturaPago, onClose, cuentasCompatibles, form, setField, onEjecutar, isPending,
}: Props) {
  const puedeEjecutar =
    !!facturaPago && !!form.cuentaBancariaId && !!form.fecha && form.monto > 0;

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
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onEjecutar} disabled={!puedeEjecutar || isPending}>
            {isPending ? "Ejecutando..." : "Ejecutar pago"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Cuenta bancaria *</Label>
          <Select value={form.cuentaBancariaId} onValueChange={(v) => setField("cuentaBancariaId", v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona cuenta..." /></SelectTrigger>
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
          <Label>Fecha *</Label>
          <DatePickerMx value={form.fecha} onChange={(v) => setField("fecha", v)} className="w-full" />
        </div>
        <div>
          <Label>Monto *</Label>
          <Input
            type="number" step="0.01" value={form.monto}
            onChange={(e) => setField("monto", Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Método de pago</Label>
          <Select value={form.metodoPago} onValueChange={(v) => setField("metodoPago", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Transferencia">Transferencia</SelectItem>
              <SelectItem value="Cheque">Cheque</SelectItem>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Referencia</Label>
          <Input value={form.referencia} onChange={(e) => setField("referencia", e.target.value)} />
        </div>
      </div>
    </FormDialogShell>
  );
}
