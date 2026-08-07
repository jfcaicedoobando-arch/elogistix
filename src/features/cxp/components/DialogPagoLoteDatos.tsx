/**
 * Sección "Datos de la transferencia" del pago en lote a proveedor.
 * Extraída v13.450.2 para mantener el diálogo bajo el límite de complejidad.
 */
import { Input } from "@/components/ui/input";
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
  const hintTc = p.tcDof ? ` · TC DOF ${p.tcDof.usdMxn} (${p.tcDof.fecha})` : "";

  return (
    <FormDialogSection title="Datos de la transferencia">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Fecha del pago</Label>
          <DatePickerMx value={p.fecha} onChange={(v) => p.onFecha(v ?? "")} className="w-full" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lote-total">Importe total ({p.moneda})</Label>
          <Input
            id="lote-total"
            inputMode="decimal"
            value={p.total}
            placeholder="0.00"
            onChange={(e) => p.onTotal(round2(Number(e.target.value) || 0))}
          />
          <p className="text-xs text-muted-foreground">
            Saldo seleccionado: {formatCurrency(p.saldoTotal, p.moneda)}
            {hintTc}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Método de pago</Label>
          <Select value={p.metodo} onValueChange={p.onMetodo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {metodosFor(p.proveedorOrigen).map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Cuenta bancaria {p.requiereCuenta ? "" : "(opcional)"}</Label>
          <Select value={p.cuentaId} onValueChange={p.onCuentaId}>
            <SelectTrigger><SelectValue placeholder={`Cuentas en ${p.moneda}`} /></SelectTrigger>
            <SelectContent>
              {p.cuentasMoneda.map((c) => (
                <SelectItem key={c.id} value={c.id}>{etiqueta(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
