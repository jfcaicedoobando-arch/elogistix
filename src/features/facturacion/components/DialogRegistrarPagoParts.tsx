/** Sub-componentes presentacionales del modal de registrar pago.
 *  Extraídos para que `DialogRegistrarPago` cumpla el límite de complejidad. */
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/formatters";

export function ResumenSaldo({
  total, pagado, saldo, moneda,
}: { total: number; pagado: number; saldo: number; moneda: string }) {
  return (
    <div className="text-body-sm text-muted-foreground space-y-0.5">
      <div>Total: <strong className="text-foreground">{formatCurrency(total, moneda)}</strong></div>
      <div>Pagado: <strong className="text-foreground">{formatCurrency(pagado, moneda)}</strong></div>
      <div>Saldo: <strong className={saldo > 0 ? "text-warning" : "text-success"}>{formatCurrency(saldo, moneda)}</strong></div>
    </div>
  );
}

export function FooterAcciones({
  ocupado, timbrandoRep, invalido, onCancel, formId,
}: {
  ocupado: boolean; timbrandoRep: boolean; invalido: boolean;
  onCancel: () => void;
  /** id del `<form>` del cuerpo: permite enviar con Enter y con este botón. */
  formId: string;
}) {
  return (
    <>
      <Button type="button" variant="outline" onClick={onCancel} disabled={ocupado}>Cancelar</Button>
      <Button type="submit" form={formId} disabled={invalido} loading={ocupado}>
        {timbrandoRep ? "Timbrando REP…" : "Registrar pago"}
      </Button>
    </>
  );
}


export function NotasPago({
  esPpdTimbrada, monedaPago, monedaFactura, montoNum, montoAplicado, tipoCambio, excede, saldo, tcBloqueado, tcRespaldo, cruceNoSoportado, errorFecha, pueIncompleto,
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
  /** EC-10: la conversión usaría el TC de respaldo (no Banxico/DOF). */
  tcRespaldo?: boolean;
  /** Cruce USD↔EUR: no soportado por la conversión de la base de datos. */
  cruceNoSoportado?: boolean;
  /** FE-03 / UIA-06: fecha de pago inválida (futura o previa a la emisión). */
  errorFecha?: string | null;
  /** B-4 (v14-2): factura PUE capturada por menos del saldo total. */
  pueIncompleto?: boolean;
}) {
  const mostrarConversion = monedaPago !== monedaFactura && montoNum > 0;
  return (
    <>
      {esPpdTimbrada && (
        <Alert>
          <AlertDescription className="text-body-sm">
            Esta factura es <strong>PPD</strong>. Al guardar, se intentará timbrar
            automáticamente el <strong>REP (Complemento de Pagos)</strong> ante el SAT.
          </AlertDescription>
        </Alert>
      )}
      {mostrarConversion && !tcBloqueado && (
        <p className="text-body-sm text-muted-foreground">
          Equivalente: {formatCurrency(montoAplicado, monedaFactura)} (TC: {tipoCambio.toFixed(4)})
        </p>
      )}
      {mostrarConversion && tcBloqueado && (
        <Alert className="border-warning/40 bg-warning/5">
          <AlertDescription className="text-body-sm">
            {cruceNoSoportado ? (
              <>
                <strong>Cruce de divisas no soportado.</strong> No se puede registrar un cobro en{" "}
                {monedaPago} para una factura en {monedaFactura}. Cobra en {monedaFactura} o en pesos
                (MXN).
              </>
            ) : tcRespaldo ? (
              <>
                <strong>Tipo de cambio de respaldo.</strong> No pudimos obtener el TC oficial de
                Banxico; registrar un cobro en {monedaPago} para una factura en {monedaFactura} con
                un TC estimado distorsionaría el REP y la diferencia cambiaria. Reintenta más tarde
                o cobra en la moneda de la factura.
              </>
            ) : (
              <>
                Esperando tipo de cambio… No se puede registrar un cobro en {monedaPago} para una
                factura en {monedaFactura} sin un tipo de cambio disponible. Intenta de nuevo en unos
                segundos; si el problema persiste, contacta a soporte.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      {pueIncompleto && (
        <Alert className="border-warning/40 bg-warning/5">
          <AlertDescription className="text-body-sm">
            Esta factura es <strong>PUE</strong> (pago en una sola exhibición): el cobro debe
            liquidar el <strong>saldo total</strong>. Si el cliente abona parcialmente, cambia la
            factura a <strong>PPD</strong>.
          </AlertDescription>
        </Alert>
      )}
      {errorFecha && (
        <p className="text-body-sm text-destructive" role="alert">{errorFecha}</p>
      )}
      {excede && (
        <p className="text-body-sm text-destructive">
          El monto excede el saldo pendiente ({formatCurrency(saldo, monedaFactura)}).
        </p>
      )}
    </>
  );
}
