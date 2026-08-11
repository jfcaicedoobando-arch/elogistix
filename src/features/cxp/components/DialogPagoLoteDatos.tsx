/**
 * Sección "Datos de la transferencia" del pago en lote a proveedor.
 * Extraída v13.450.2; rediseñada v13.498.0 con el layout del cobro en lote (CxC).
 */
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { formatCurrency } from "@/lib/formatters";
import { metodosFor, referenciaHint, type OrigenProveedor } from "./pagoProveedorHelpers";
import { round2 } from "@/features/cxp/services/pagoProveedorLote";

interface CuentaLote {
  id: string;
  alias: string | null;
  banco: string;
  moneda: string;
}

interface Props {
  moneda: string;
  proveedorOrigen: OrigenProveedor;
  fecha: string;
  onFecha: (v: string) => void;
  total: string;
  onTotal: (v: number) => void;
  saldoTotal: number;
  tcDof: { usdMxn: number; fecha: string } | null;
  metodo: string;
  onMetodo: (v: string) => void;
  cuentaId: string;
  onCuentaId: (v: string) => void;
  cuentasMoneda: CuentaLote[];
  requiereCuenta: boolean;
  referencia: string;
  onReferencia: (v: string) => void;
}

function etiqueta(c: CuentaLote) {
  const alias = (c.alias ?? "").trim();
  if (!alias) return `${c.banco} (${c.moneda})`;
  if (alias.toLowerCase().includes(c.banco.toLowerCase())) return `${alias} (${c.moneda})`;
  return `${alias} — ${c.banco} (${c.moneda})`;
}

export function DialogPagoLoteDatos(p: Props) {
  return (
    <FormDialogSection flat title="Datos de la transferencia">
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Fecha del pago</Label>
          <DatePickerMx value={p.fecha} onChange={(v) => p.onFecha(v ?? "")} className="w-full" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lote-total">Importe total</Label>
          <MoneyInput
            id="lote-total"
            value={p.total === "" ? null : Number(p.total)}
            currency={p.moneda}
            onChange={(n: number) => p.onTotal(round2(n))}
          />
          <p className="truncate text-xs text-muted-foreground">
            Saldo {formatCurrency(p.saldoTotal, p.moneda)}
            {p.tcDof ? ` · TC DOF ${p.tcDof.usdMxn}` : ""}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Método de pago</Label>
          <Select value={p.metodo} onValueChange={p.onMetodo}>
            <SelectTrigger aria-label="Método de pago"><SelectValue /></SelectTrigger>
            <SelectContent>
              {metodosFor(p.proveedorOrigen).map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Catálogo interno</p>
        </div>
        <div className="space-y-1.5">
          <Label>Cuenta bancaria</Label>
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
          <p className="text-xs text-muted-foreground">
            {p.requiereCuenta ? "Requerida" : "Opcional"}
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="lote-ref">Referencia bancaria</Label>
          <Input
            id="lote-ref"
            value={p.referencia}
            placeholder={referenciaHint(p.metodo)}
            onChange={(e) => p.onReferencia(e.target.value)}
          />
        </div>
      </div>
    </FormDialogSection>
  );
}
