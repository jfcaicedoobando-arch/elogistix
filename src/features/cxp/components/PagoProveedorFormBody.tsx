/**
 * Cuerpo del formulario para DialogRegistrarPagoProveedor.
 * Extraído v12.95.23 para mantener el dialog ≤200 LOC.
 */
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormSection } from "./facturaFormPrimitives";
import { PagoSaldoRestante } from "./PagoProveedorBits";
import { referenciaHint } from "./pagoProveedorHelpers";
import { formatNumber } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";
import type { Database } from "@/integrations/supabase/types";
import type { CuentaBancaria } from "@/features/tesoreria";
import type { ImpactoPago } from "@/features/cxp/services/pagoImpactoPreview";
import { PagoImpactoPreview } from "./PagoImpactoPreview";


type Moneda = Database["public"]["Enums"]["moneda"];

interface Props {
  factura: FacturaCxP | null;
  fecha: string;
  setFecha: (v: string) => void;
  metodo: string;
  setMetodo: (v: string) => void;
  metodosDisponibles: readonly string[];
  monto: string;
  setMonto: (v: string) => void;
  moneda: Moneda;
  setMoneda: (v: Moneda) => void;
  tc: string;
  setTc: (v: string) => void;
  showTc: boolean;
  saldoRestante: number;
  excede: boolean;
  esUsdPagadoEnMxn: boolean;
  diffMxn: string;
  setDiffMxn: (v: string) => void;
  referencia: string;
  setReferencia: (v: string) => void;
  notas: string;
  setNotas: (v: string) => void;
  montoEnMonedaFactura: number;
  bloqueadoPorTc: boolean;
  /** R6-N1: cuenta bancaria de donde sale el pago. */
  cuentas: CuentaBancaria[];
  cuentaId: string;
  setCuentaId: (v: string) => void;
  requiereCuenta: boolean;
  /** Incoherencias de IVA/totales de la factura (informativas). */
  validacion: { error: string | null; avisos: string[] };
  /** Vista previa del impacto del pago (factura, proveedor y banco). */
  impacto: ImpactoPago | null;
  cargandoSaldoProveedor?: boolean;
}


export function PagoProveedorFormBody(p: Props) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
      {p.validacion.avisos.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 space-y-1">
          <p className="text-xs font-semibold text-warning">Revisa la factura</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {p.validacion.avisos.map((a) => (
              <li key={a} className="text-xs text-warning">{a}</li>
            ))}
          </ul>
        </div>
      )}

      <FormSection title="Fecha y método">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Fecha de pago</Label>
            <DatePickerMx value={p.fecha} onChange={p.setFecha} className="w-full" />
          </div>
          <div className="space-y-1">
            <Label>Método</Label>
            <Select value={p.metodo} onValueChange={p.setMetodo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {p.metodosDisponibles.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cuenta-bancaria">
            Cuenta bancaria{p.requiereCuenta ? " *" : " (opcional)"}
          </Label>
          <Select value={p.cuentaId} onValueChange={p.setCuentaId}>
            <SelectTrigger id="cuenta-bancaria">
              <SelectValue placeholder="Selecciona la cuenta de donde sale el pago" />
            </SelectTrigger>
            <SelectContent>
              {p.cuentas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.banco} · {c.alias ?? "Cuenta"} ({c.moneda})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {p.requiereCuenta && !p.cuentaId && (
            <p className="text-xs text-destructive">
              Selecciona la cuenta bancaria de donde sale el pago.
            </p>
          )}
          {p.cuentaId && (
            <p className="text-label text-muted-foreground">
              Se registrará el movimiento bancario conciliado en esta cuenta.
            </p>
          )}
        </div>
      </FormSection>


      <FormSection title="Monto">
        <div className={cn("grid grid-cols-1 gap-3", p.showTc ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <div className="space-y-1">
            <Label>Monto</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00"
                className="pl-7 text-right tabular-nums"
                value={p.monto} onChange={(e) => p.setMonto(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Moneda pago</Label>
            <Select value={p.moneda} onValueChange={(v) => p.setMoneda(v as Moneda)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {p.showTc && (
            <div className="space-y-1">
              <Label>Tipo de cambio</Label>
              <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00"
                value={p.tc} onChange={(e) => p.setTc(e.target.value)} />
            </div>
          )}
        </div>

        {p.validacion.error && p.monto !== "" && (
          <p className="text-xs text-destructive">{p.validacion.error}</p>
        )}

        <PagoSaldoRestante factura={p.factura} saldoRestante={p.saldoRestante} excede={p.excede} />

        <PagoImpactoPreview
          impacto={p.impacto}
          proveedorNombre={p.factura?.proveedor_nombre ?? "el proveedor"}
          cargandoProveedor={p.cargandoSaldoProveedor}
        />

        {p.esUsdPagadoEnMxn && p.factura && (
          <p className="text-xs text-muted-foreground">
            {p.bloqueadoPorTc
              ? "Captura el tipo de cambio para validar el pago contra el saldo en " + p.factura.moneda + "."
              : `≈ ${p.factura.moneda} ${formatNumber(p.montoEnMonedaFactura, { decimals: 2 })} al TC capturado.`}
          </p>
        )}
      </FormSection>


      {p.esUsdPagadoEnMxn && (
        <FormSection title="Diferencia cambiaria">
          <div className="space-y-1">
            <Label>Diferencia cambiaria MXN (opcional)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00"
                className="pl-7 text-right tabular-nums"
                value={p.diffMxn} onChange={(e) => p.setDiffMxn(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Captura la diferencia cambiaria entre el TC de la factura y el TC del pago.
            </p>
          </div>
        </FormSection>
      )}

      <FormSection title="Referencia y notas">
        <div className="space-y-1">
          <Label>Referencia</Label>
          <Input value={p.referencia} onChange={(e) => p.setReferencia(e.target.value)}
            placeholder={referenciaHint(p.metodo)} />
          <p className="text-label text-muted-foreground">{referenciaHint(p.metodo)}</p>
        </div>
        <div className="space-y-1">
          <Label>Notas</Label>
          <Textarea value={p.notas} onChange={(e) => p.setNotas(e.target.value)} rows={2}
            placeholder="Observaciones internas…" />
        </div>
      </FormSection>
    </div>
  );
}
