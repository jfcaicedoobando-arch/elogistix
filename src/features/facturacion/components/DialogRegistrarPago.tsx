/**
 * Registrar pago a factura del cliente.
 * Migrado a `FormDialogShell` (v13.120.0).
 *
 * Fase 5 (Proforma → Factura): cuando la factura está timbrada y es **PPD**,
 * tras registrar el pago se dispara automáticamente el timbrado del REP
 * (Recibo Electrónico de Pago) vía `emitirRep`. La lógica de submit + auto-REP
 * vive en `useRegistrarPagoSubmit` para mantener este componente delgado.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useExchangeRates } from "@/features/catalogos/hooks";
import { usePagosFactura } from "@/features/facturacion/hooks";
import { useNotasCreditoAplicadas } from "@/features/facturacion/hooks/useSaldoFactura";
import { calcularSaldoFactura } from "@/lib/financial/saldoFactura";
import { useRegistrarPagoSubmit } from "@/features/facturacion/hooks/useRegistrarPagoSubmit";
import { PagoFormFields, type PagoFormValues } from "./PagoFormFields";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { ResumenSaldo, FooterAcciones, NotasPago } from "./DialogRegistrarPagoParts";
import { todayLocalISO } from "@/lib/date/today";
import { factorEntreMonedas } from "@/lib/financial/convertir";

interface Factura {
  id: string;
  numero: string;
  total: number;
  moneda: string;
  /** `PPD` requiere REP automático tras cada abono; `PUE` no. */
  metodoPago?: string | null;
  /** UUID fiscal del CFDI emitido. Sin él no se puede timbrar REP. */
  uuidFiscal?: string | null;
  /** Fecha de emisión (ISO corto). FE-03: cota inferior para la fecha del pago. */
  fechaEmision?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: Factura | null;
}

function convertirAMonedaFactura(
  monto: number, monedaPago: string, monedaFactura: string,
  rates: { usdMxn: number; eurMxn: number } | undefined,
): number {
  // FIX C6: el factor sale del canon único (MXN como puente). Sin TC confiable
  // devuelve null y aquí se traduce a 0: nunca se trata USD/EUR como MXN.
  const factor = factorEntreMonedas(monedaPago, monedaFactura, {
    usd: rates?.usdMxn, eur: rates?.eurMxn,
  });
  return factor === null ? 0 : monto * factor;
}

const today = () => todayLocalISO();

/** FE-03 / UIA-06: misma regla y mensajes que `validarFechas` de CxP. */
export function validarFechaPago(
  fecha: string, hoy: string, fechaEmision?: string | null,
): string | null {
  if (!fecha) return "Captura la fecha del pago";
  if (fecha > hoy) return "La fecha del pago no puede ser futura";
  if (fechaEmision && fecha < fechaEmision) {
    return "La fecha del pago no puede ser anterior a la fecha de emisión de la factura";
  }
  return null;
}

export function DialogRegistrarPago({ open, onOpenChange, factura }: Props) {
  const { data: rates } = useExchangeRates();
  const { data: cuentas = [] } = useCuentasBancarias();
  const { data: pagosPrevios = [] } = usePagosFactura(factura?.id);
  const { data: notasAplicadas = [] } = useNotasCreditoAplicadas(factura?.id);
  const { submit, isPending, timbrandoRep } = useRegistrarPagoSubmit(() => onOpenChange(false));

  // A1: canon único `@/lib/financial/saldoFactura` (descuenta pagos y NC aplicadas).
  const { saldo, pagado: totalPagado } = useMemo(
    () => calcularSaldoFactura(factura?.total ?? 0, pagosPrevios, notasAplicadas),
    [factura, pagosPrevios, notasAplicadas],
  );

  const [values, setValues] = useState<PagoFormValues>({
    fecha: today(), monto: "", moneda: "MXN",
    formaPago: "03", referencia: "", notas: "", cuentaBancariaId: "",
  });

  // FE-02: inicializar una sola vez por apertura (open + factura.id). Antes las
  // deps vivas (objeto factura nuevo en cada refetch, saldo derivado de queries)
  // re-ejecutaban el efecto y borraban lo que el usuario ya había capturado.
  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !factura) {
      initializedForRef.current = null;
      return;
    }
    if (initializedForRef.current === factura.id) return;
    initializedForRef.current = factura.id;
    setValues({
      fecha: today(),
      monto: saldo > 0 ? saldo.toFixed(2) : "",
      moneda: factura.moneda,
      formaPago: "03", referencia: "", notas: "", cuentaBancariaId: "",
    });
  }, [open, factura, saldo]);

  if (!factura) return null;

  const montoNum = Number(values.monto) || 0;
  const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
  const excede = montoAplicado > saldo + 0.01;
  const tipoCambio = montoNum > 0 ? montoAplicado / montoNum : 1;
  // FE-01 / UIA-01: cross-moneda sin TC confiable (factorEntreMonedas === null,
  // p. ej. exchange-rates caído) → bloqueamos el submit en vez de dejar el
  // insert reventar contra CHECK (tipo_cambio > 0) con un 23514 crudo.
  const tcBloqueado = factorEntreMonedas(values.moneda, factura.moneda, {
    usd: rates?.usdMxn, eur: rates?.eurMxn,
  }) === null;
  // FE-03 / UIA-06: fecha futura o anterior a la emisión distorsiona REP y aging.
  const errorFecha = validarFechaPago(values.fecha, today(), factura.fechaEmision);
  const invalido = montoNum <= 0 || excede || tcBloqueado || errorFecha !== null;
  const esPpdTimbrada = factura.metodoPago === "PPD" && !!factura.uuidFiscal;

  const handleChange = <K extends keyof PagoFormValues>(k: K, v: PagoFormValues[K]) =>
    setValues((s) => ({
      ...s,
      [k]: v,
      // C4: al cambiar la moneda del cobro, la cuenta elegida deja de ser
      // válida (el banco sólo acepta abonos en su propia moneda).
      ...(k === "moneda" ? { cuentaBancariaId: "" } : null),
    }));

  const handleGuardar = () => {
    if (invalido) return; // FE-03: defensa en el handler, no sólo botón deshabilitado
    submit({
      facturaId: factura.id,
      facturaNumero: factura.numero,
      fecha: values.fecha,
      monto: montoNum,
      moneda: values.moneda as "MXN" | "USD" | "EUR",
      tipoCambio,
      montoAplicado,
      formaPago: values.formaPago,
      referencia: values.referencia,
      notas: values.notas,
      cuentaBancariaId: values.cuentaBancariaId || null,
      esPpdTimbrada,
    });
  };

  const headerAside = (
    <ResumenSaldo total={factura.total} pagado={totalPagado} saldo={saldo} moneda={factura.moneda} />
  );

  const ocupado = isPending || timbrandoRep;
  const footer = (
    <FooterAcciones
      ocupado={ocupado}
      timbrandoRep={timbrandoRep}
      invalido={invalido}
      onCancel={() => onOpenChange(false)}
      onGuardar={handleGuardar}
    />
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ArrowDownToLine}
      title={`Registrar pago — Factura ${factura.numero}`}
      description="Captura el abono recibido del cliente."
      headerAside={headerAside}
      size="md"
      footer={footer}
    >
      <PagoFormFields values={values} onChange={handleChange} cuentas={cuentas} />
      <NotasPago
        esPpdTimbrada={esPpdTimbrada}
        monedaPago={values.moneda}
        monedaFactura={factura.moneda}
        montoNum={montoNum}
        montoAplicado={montoAplicado}
        tipoCambio={tipoCambio}
        excede={excede}
        saldo={saldo}
        tcBloqueado={tcBloqueado}
        errorFecha={errorFecha}
      />

    </FormDialogShell>
  );
}
