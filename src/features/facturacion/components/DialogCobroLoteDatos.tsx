/**
 * Sección "Datos del depósito" del cobro en lote de cliente.
 */
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { formatCurrency } from "@/lib/formatters";
import { FORMAS_PAGO_SAT } from "@/constants/catalogosSAT";
import { round2 } from "@/features/facturacion/services/pagoClienteLote";

interface CuentaLote {
  id: string;
  alias: string | null;
  banco: string;
  moneda: string;
}

interface Props {
  moneda: string;
  fecha: string;
  onFecha: (v: string) => void;
  total: string;
  onTotal: (v: number) => void;
  saldoTotal: number;
  tcDof: { usdMxn: number; fecha: string } | null;
  formaPago: string;
  onFormaPago: (v: string) => void;
  cuentaId: string;
  onCuentaId: (v: string) => void;
  cuentasMoneda: CuentaLote[];
  referencia: string;
  onReferencia: (v: string) => void;
}

function etiqueta(c: CuentaLote) {
  const alias = (c.alias ?? "").trim();
  if (!alias) return `${c.banco} (${c.moneda})`;
  if (alias.toLowerCase().includes(c.banco.toLowerCase())) return `${alias} (${c.moneda})`;
  return `${alias} — ${c.banco} (${c.moneda})`;
}

export function DialogCobroLoteDatos(p: Props) {
  const hintTc = p.tcDof ? ` · TC DOF ${p.tcDof.usdMxn} (${p.tcDof.fecha})` : "";

  return (
    <FormDialogSection title="Datos del depósito">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Fecha del cobro</Label>
          <DatePickerMx value={p.fecha} onChange={(v) => p.onFecha(v ?? "")} className="w-full" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cobro-lote-total">Importe recibido ({p.moneda})</Label>
          <MoneyInput
            id="cobro-lote-total"
            value={p.total === "" ? null : Number(p.total)}
            currency={p.moneda}
            onChange={(n: number) => p.onTotal(round2(n))}
          />
          <p className="text-xs text-muted-foreground">
            Saldo seleccionado: {formatCurrency(p.saldoTotal, p.moneda)}
            {hintTc}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Forma de pago (SAT)</Label>
          <Select value={p.formaPago} onValueChange={p.onFormaPago}>
            <SelectTrigger aria-label="Forma de pago"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS_PAGO_SAT.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Cuenta bancaria (opcional)</Label>
          <Select value={p.cuentaId} onValueChange={p.onCuentaId}>
            <SelectTrigger aria-label="Cuenta bancaria">
              <SelectValue placeholder={`Cuentas en ${p.moneda}`} />
            </SelectTrigger>
            <SelectContent>
              {p.cuentasMoneda.map((c) => (
                <SelectItem key={c.id} value={c.id}>{etiqueta(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cobro-lote-ref">Referencia bancaria</Label>
          <Input
            id="cobro-lote-ref"
            value={p.referencia}
            placeholder="Número de operación del depósito"
            onChange={(e) => p.onReferencia(e.target.value)}
          />
        </div>
      </div>
    </FormDialogSection>
  );
}
