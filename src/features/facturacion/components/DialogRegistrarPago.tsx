/**
 * Registrar pago a factura del cliente.
 * Migrado a `FormDialogShell` (v13.120.0).
 *
 * Fase 5 (Proforma → Factura): cuando la factura está timbrada y es **PPD**,
 * tras registrar el pago se dispara automáticamente el timbrado del REP
 * (Recibo Electrónico de Pago) vía `emitirRep`. La lógica de submit + auto-REP
 * vive en `useRegistrarPagoSubmit` para mantener este componente delgado.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useExchangeRates } from "@/features/catalogos/hooks";
import { usePagosFactura } from "@/features/facturacion/hooks";
import { useNotasCreditoAplicadas } from "@/features/facturacion/hooks/useSaldoFactura";
import { calcularSaldoFactura } from "@/lib/financial/saldoFactura";
import { useRegistrarPagoSubmit } from "@/features/facturacion/hooks/useRegistrarPagoSubmit";
import { PagoFormFields, type PagoFormValues } from "./PagoFormFields";
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

export function DialogRegistrarPago({ open, onOpenChange, factura }: Props) {
  const { data: rates } = useExchangeRates();
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
    formaPago: "03", referencia: "", notas: "",
  });

  useEffect(() => {
    if (open && factura) {
      setValues({
        fecha: today(),
        monto: saldo > 0 ? saldo.toFixed(2) : "",
        moneda: factura.moneda,
        formaPago: "03", referencia: "", notas: "",
      });
    }
  }, [open, factura, saldo]);

  if (!factura) return null;

  const montoNum = Number(values.monto) || 0;
  const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
  const excede = montoAplicado > saldo + 0.01;
  const invalido = montoNum <= 0 || excede;
  const tipoCambio = montoNum > 0 ? montoAplicado / montoNum : 1;
  const esPpdTimbrada = factura.metodoPago === "PPD" && !!factura.uuidFiscal;

  const handleChange = <K extends keyof PagoFormValues>(k: K, v: PagoFormValues[K]) =>
    setValues((s) => ({ ...s, [k]: v }));

  const handleGuardar = () => submit({
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
    esPpdTimbrada,
  });

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
      <PagoFormFields values={values} onChange={handleChange} />
      <NotasPago
        esPpdTimbrada={esPpdTimbrada}
        monedaPago={values.moneda}
        monedaFactura={factura.moneda}
        montoNum={montoNum}
        montoAplicado={montoAplicado}
        tipoCambio={tipoCambio}
        excede={excede}
        saldo={saldo}
      />

    </FormDialogShell>
  );
}
