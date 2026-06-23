/**
 * Registrar pago a factura del cliente.
 * Migrado a `FormDialogShell` (v13.120.0).
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, BanknoteArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { formatCurrency } from "@/lib/formatters";
import { useExchangeRates } from "@/features/catalogos/hooks";
import { useRegistrarPagoFactura, usePagosFactura } from "@/features/facturacion/hooks";
import { useRegistrarActividad } from "@/hooks/shared";
import { useToast } from "@/hooks/shared";
import { notifySuccess, notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { getErrorMessage } from "@/lib/errors";
import { PagoFormFields, type PagoFormValues } from "./PagoFormFields";

interface Factura {
  id: string;
  numero: string;
  total: number;
  moneda: string;
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
  if (monedaPago === monedaFactura) return monto;
  if (!rates || !rates.usdMxn) return monto;
  const toMxn: Record<string, number> = { MXN: 1, USD: rates.usdMxn, EUR: rates.eurMxn };
  const enMxn = monto * (toMxn[monedaPago] ?? 1);
  const factorFactura = toMxn[monedaFactura] ?? 1;
  return enMxn / factorFactura;
}

const today = () => new Date().toISOString().slice(0, 10);

export function DialogRegistrarPago({ open, onOpenChange, factura }: Props) {
  const { toast } = useToast();
  const { data: rates } = useExchangeRates();
  const { data: pagosPrevios = [] } = usePagosFactura(factura?.id);
  const registrar = useRegistrarPagoFactura();
  const registrarActividad = useRegistrarActividad();

  const totalPagado = useMemo(
    () => pagosPrevios.reduce((s, p) => s + Number(p.monto_aplicado_factura), 0),
    [pagosPrevios],
  );
  const saldo = useMemo(() => (factura ? factura.total - totalPagado : 0), [factura, totalPagado]);

  const [values, setValues] = useState<PagoFormValues>({
    fecha: today(), monto: "", moneda: "MXN",
    formaPago: "Transferencia", referencia: "", notas: "",
  });

  useEffect(() => {
    if (open && factura) {
      setValues({
        fecha: today(),
        monto: saldo > 0 ? saldo.toFixed(2) : "",
        moneda: factura.moneda,
        formaPago: "Transferencia", referencia: "", notas: "",
      });
    }
  }, [open, factura, saldo]);

  if (!factura) return null;

  const montoNum = Number(values.monto) || 0;
  const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
  const excede = montoAplicado > saldo + 0.01;
  const invalido = montoNum <= 0 || excede;
  const tipoCambio = montoNum > 0 ? montoAplicado / montoNum : 1;

  const handleChange = <K extends keyof PagoFormValues>(k: K, v: PagoFormValues[K]) =>
    setValues((s) => ({ ...s, [k]: v }));

  const handleGuardar = async () => {
    try {
      await registrar.mutateAsync({
        factura_id: factura.id,
        fecha_pago: values.fecha,
        monto: montoNum,
        moneda: values.moneda as "MXN" | "USD" | "EUR",
        tipo_cambio: tipoCambio,
        monto_aplicado_factura: montoAplicado,
        forma_pago: values.formaPago,
        referencia: values.referencia,
        notas: values.notas,
      });
      registrarActividad.mutate({
        accion: "crear", modulo: "facturas", entidad_id: factura.id,
        entidad_nombre: `Pago ${formatCurrency(montoNum, values.moneda)} factura ${factura.numero}`,
      });
      notifySuccess(toast, { title: "Pago registrado" });
      onOpenChange(false);
    } catch (err) {
      notifyError(toast, {
        title: "Error al registrar pago", description: getErrorMessage(err),
        method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
  };

  const headerAside = (
    <div className="text-xs text-muted-foreground space-y-0.5">
      <div>Total: <strong className="text-foreground">{formatCurrency(factura.total, factura.moneda)}</strong></div>
      <div>Pagado: <strong className="text-foreground">{formatCurrency(totalPagado, factura.moneda)}</strong></div>
      <div>Saldo: <strong className={saldo > 0 ? "text-warning" : "text-success"}>{formatCurrency(saldo, factura.moneda)}</strong></div>
    </div>
  );

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={registrar.isPending}>Cancelar</Button>
      <Button onClick={handleGuardar} disabled={invalido || registrar.isPending}>
        {registrar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
        Registrar pago
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={BanknoteArrowDown}
      title={`Registrar pago — Factura ${factura.numero}`}
      description="Captura el abono recibido del cliente."
      headerAside={headerAside}
      size="md"
      footer={footer}
    >
      <PagoFormFields values={values} onChange={handleChange} />

      {values.moneda !== factura.moneda && montoNum > 0 && (
        <p className="text-xs text-muted-foreground">
          Equivalente: {formatCurrency(montoAplicado, factura.moneda)} (TC: {tipoCambio.toFixed(4)})
        </p>
      )}
      {excede && (
        <p className="text-xs text-destructive">
          El monto excede el saldo pendiente ({formatCurrency(saldo, factura.moneda)}).
        </p>
      )}
    </FormDialogShell>
  );
}
