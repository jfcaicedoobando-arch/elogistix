/** Sub-componentes presentacionales del modal de registrar pago.
 *  Extraídos para que `DialogRegistrarPago` cumpla el límite de complejidad. */
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/formatters";

export function ResumenSaldo({
  total, pagado, saldo, moneda,
}: { total: number; pagado: number; saldo: number; moneda: string }) {
  return (
    <div className="text-xs text-muted-foreground space-y-0.5">
      <div>Total: <strong className="text-foreground">{formatCurrency(total, moneda)}</strong></div>
      <div>Pagado: <strong className="text-foreground">{formatCurrency(pagado, moneda)}</strong></div>
      <div>Saldo: <strong className={saldo > 0 ? "text-warning" : "text-success"}>{formatCurrency(saldo, moneda)}</strong></div>
    </div>
  );
}

export function FooterAcciones({
  ocupado, timbrandoRep, invalido, onCancel, onGuardar,
}: {
  ocupado: boolean; timbrandoRep: boolean; invalido: boolean;
  onCancel: () => void; onGuardar: () => void;
}) {
  return (
    <>
      <Button variant="outline" onClick={onCancel} disabled={ocupado}>Cancelar</Button>
      <Button onClick={onGuardar} disabled={invalido} loading={ocupado}>
        {timbrandoRep ? "Timbrando REP…" : "Registrar pago"}
      </Button>
    </>
  );
}

export function NotasPago({
  esPpdTimbrada, monedaPago, monedaFactura, montoNum, montoAplicado, tipoCambio, excede, saldo, tcBloqueado, errorFecha,
}: {
  esPpdTimbrada: boolean;
  monedaPago: string;
  monedaFactura: string;
  montoNum: number;
  montoAplicado: number;
  tipoCambio: number;
  excede: boolean;
  saldo: number;
  /** FE-01 / UIA-01: cross-moneda sin tipo de cambio confiable. */
  tcBloqueado?: boolean;
  /** FE-03 / UIA-06: fecha de pago inválida (futura o previa a la emisión). */
  errorFecha?: string | null;
}) {
  const mostrarConversion = monedaPago !== monedaFactura && montoNum > 0;
  return (
    <>
      {esPpdTimbrada && (
        <Alert>
          <AlertDescription className="text-xs">
            Esta factura es <strong>PPD</strong>. Al guardar, se intentará timbrar
            automáticamente el <strong>REP (Complemento de Pagos)</strong> ante el SAT.
          </AlertDescription>
        </Alert>
      )}
      {mostrarConversion && !tcBloqueado && (
        <p className="text-xs text-muted-foreground">
          Equivalente: {formatCurrency(montoAplicado, monedaFactura)} (TC: {tipoCambio.toFixed(4)})
        </p>
      )}
      {mostrarConversion && tcBloqueado && (
        <Alert className="border-warning/40 bg-warning/5">
          <AlertDescription className="text-xs">
            Esperando tipo de cambio… No se puede registrar un cobro en {monedaPago} para una
            factura en {monedaFactura} sin un tipo de cambio disponible. Intenta de nuevo en unos
            segundos; si el problema persiste, contacta a soporte.
          </AlertDescription>
        </Alert>
      )}
      {errorFecha && (
        <p className="text-xs text-destructive" role="alert">{errorFecha}</p>
      )}
      {excede && (
        <p className="text-xs text-destructive">
          El monto excede el saldo pendiente ({formatCurrency(saldo, monedaFactura)}).
        </p>
      )}
    </>
  );
}
