/**
 * Registrar pago a factura del cliente.
 * Migrado a `FormDialogShell` (v13.120.0).
 *
 * Fase 5 (Proforma → Factura): cuando la factura está timbrada y es **PPD**,
 * tras registrar el pago se dispara automáticamente el timbrado del REP
 * (Recibo Electrónico de Pago) vía `emitirRep`. La lógica de submit + auto-REP
 * vive en `useRegistrarPagoSubmit` para mantener este componente delgado.
 */
import { useMemo, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useExchangeRates } from "@/features/catalogos/hooks";
import { usePagosFactura } from "@/features/facturacion/hooks";
import { useNotasCreditoAplicadas } from "@/features/facturacion/hooks/useSaldoFactura";
import { calcularSaldoFactura } from "@/lib/financial/saldoFactura";
import { useRegistrarPagoSubmit } from "@/features/facturacion/hooks/useRegistrarPagoSubmit";
import { useRegistrarPagoInit } from "@/features/facturacion/hooks/useRegistrarPagoInit";
import { PagoFormFields, type PagoFormValues } from "./PagoFormFields";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { ResumenSaldo, FooterAcciones, NotasPago } from "./DialogRegistrarPagoParts";
import { todayLocalISO } from "@/lib/date/today";
import { derivarEstadoPago } from "./registrarPagoDerivados";
import type { Moneda } from "@/types/db";

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
  /** Estado de la factura: las terminales (Pagada/Cancelada/…) no tienen saldo. */
  estado?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: Factura | null;
}


const today = () => todayLocalISO();

/** id del formulario del cuerpo, usado por el botón submit del footer. */
const FORM_ID = "form-registrar-pago";


export function DialogRegistrarPago({ open, onOpenChange, factura }: Props) {
  const { data: cuentas = [] } = useCuentasBancarias();
  const { data: pagosPrevios = [] } = usePagosFactura(factura?.id);
  const { data: notasAplicadas = [] } = useNotasCreditoAplicadas(factura?.id);
  const { submit, isPending, timbrandoRep } = useRegistrarPagoSubmit(() => onOpenChange(false));

  // A1: canon `saldoFactura` (pagos + NC). Se pasa el ESTADO para que las
  // terminales (Pagada/Cancelada/…) den saldo 0 (adeudo fantasma legacy).
  const { saldo, pagado: totalPagado } = useMemo(
    () => calcularSaldoFactura(factura?.total ?? 0, pagosPrevios, notasAplicadas, factura?.estado),
    [factura, pagosPrevios, notasAplicadas],
  );

  const [values, setValues] = useState<PagoFormValues>({
    fecha: today(), monto: "", moneda: "MXN",
    formaPago: "03", referencia: "", notas: "", cuentaBancariaId: "",
  });

  // B-03: el pago puede tener fecha PASADA (`fecha` es editable); valuarlo con el
  // TC de hoy distorsiona el importe aplicado. Se pide el DOF de esa fecha.
  const { data: rates } = useExchangeRates(
    /^\d{4}-\d{2}-\d{2}$/.test(values.fecha) ? values.fecha : undefined,
  );


  const clientRequestIdRef = useRegistrarPagoInit(open, factura, saldo, setValues);

  if (!factura) return null;

  const {
    montoNum, montoAplicado, tipoCambio, excede, tcBloqueado, tcRespaldo, cruceNoSoportado, errorFecha, pueIncompleto, invalido,
  } = derivarEstadoPago({
      monto: values.monto,
      monedaPago: values.moneda,
      fecha: values.fecha,
      hoy: today(),
      monedaFactura: factura.moneda,
      fechaEmision: factura.fechaEmision,
      saldo,
      rates,
      metodoPagoFactura: factura.metodoPago,
    });

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
      moneda: values.moneda as Moneda,
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

  // YG-04: hay datos capturados que se perderían al cerrar el modal.
  const isDirty =
    values.referencia.trim() !== "" || values.notas.trim() !== "" ||
    montoNum !== Number(saldo.toFixed(2));

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
      isDirty={isDirty}
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
          tcRespaldo={tcRespaldo}
          cruceNoSoportado={cruceNoSoportado}
          errorFecha={errorFecha}
          pueIncompleto={pueIncompleto}
        />
      </form>
    </FormDialogShell>
  );
}

