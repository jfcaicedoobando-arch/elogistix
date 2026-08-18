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
import { TOLERANCIA_SOBREPAGO } from "@/lib/financial/toleranciaPago";
import { validarFechaPago } from "@/features/facturacion/domain/validarFechaPago";

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

/** id del formulario del cuerpo, usado por el botón submit del footer. */
const FORM_ID = "form-registrar-pago";


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
  // BL-14: UUID por apertura del dialog; todos los reintentos del MISMO
  // submit comparten el id y el UNIQUE parcial de BD absorbe el duplicado.
  const clientRequestIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !factura) {
      initializedForRef.current = null;
      clientRequestIdRef.current = null;
      return;
    }
    if (initializedForRef.current === factura.id) return;
    initializedForRef.current = factura.id;
    clientRequestIdRef.current = crypto.randomUUID();
    setValues({
      fecha: today(),
      // EC-12: redondeo hacia ARRIBA al centavo. Con `toFixed` (al más
      // cercano) el prefill podía quedar 1 centavo por debajo del saldo y
      // dejar un residuo impagable (la factura nunca quedaba saldada).
      monto: saldo > 0 ? (Math.ceil((saldo - 1e-9) * 100) / 100).toFixed(2) : "",
      moneda: factura.moneda,
      formaPago: "03", referencia: "", notas: "", cuentaBancariaId: "",
    });
  }, [open, factura, saldo]);

  if (!factura) return null;

  const montoNum = Number(values.monto) || 0;
  const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
  // BUG-15: tolerancia canónica de sobrepago (medio centavo) compartida con
  // CobroLoteRenglon — antes aquí era 0.01 y allá 0.009.
  const excede = montoAplicado > saldo + TOLERANCIA_SOBREPAGO;
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

  const handleGuardar = (e?: React.FormEvent) => {
    e?.preventDefault();
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
      clientRequestId: clientRequestIdRef.current,
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
      formId={FORM_ID}
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
      {/* v13.550.0 — `<form>` real: Enter en cualquier campo guarda el pago
          (el botón del footer envía este formulario vía `form={FORM_ID}`). */}
      <form id={FORM_ID} onSubmit={handleGuardar} className="space-y-5">
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
      </form>
    </FormDialogShell>
  );
}

