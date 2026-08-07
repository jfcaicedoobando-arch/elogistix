/**
 * Selección de cuenta bancaria y prefill del monto para el pago a proveedor.
 * Extraído v13.450.2 para mantener `usePagoProveedorForm` bajo el límite de complejidad.
 */
import { useEffect, useMemo } from "react";

interface CuentaLike {
  id: string;
  moneda: string;
}

/** Cuentas de la moneda del pago + preselección automática al abrir. */
export function useCuentaPagoSeleccionada<T extends CuentaLike>(args: {
  cuentas: T[];
  moneda: string;
  open: boolean;
  cuentaId: string;
  setCuentaId: (id: string) => void;
  pagoEditarId: string | null;
}) {
  const { cuentas, moneda, open, cuentaId, setCuentaId, pagoEditarId } = args;

  const cuentasDeMoneda = useMemo(
    () => cuentas.filter((c) => c.moneda === moneda),
    [cuentas, moneda],
  );

  useEffect(() => {
    if (!open || cuentaId || cuentas.length === 0 || pagoEditarId) return;
    setCuentaId((cuentasDeMoneda[0] ?? cuentas[0]).id);
  }, [open, cuentaId, cuentas, cuentasDeMoneda, pagoEditarId, setCuentaId]);

  useEffect(() => {
    if (!open) setCuentaId("");
  }, [open, setCuentaId]);

  const cuentaSeleccionada = useMemo(
    () => cuentas.find((c) => c.id === cuentaId) ?? null,
    [cuentas, cuentaId],
  );

  return { cuentasDeMoneda, cuentaSeleccionada };
}

/**
 * Prefill del monto: al saldar en MXN una factura extranjera usa el TC;
 * si la moneda del pago coincide con la de la factura, usa el saldo tal cual.
 * En edición no se reescribe el monto capturado.
 */
export function usePrefillMontoPago(args: {
  open: boolean;
  facturaId: string | undefined;
  facturaSaldo: number | undefined;
  facturaMoneda: string | undefined;
  moneda: string;
  esUsdPagadoEnMxn: boolean;
  tcNum: number | null;
  pagoEditarId: string | null;
  setMonto: (v: string) => void;
}) {
  const {
    open, facturaId, facturaSaldo, facturaMoneda, moneda,
    esUsdPagadoEnMxn, tcNum, pagoEditarId, setMonto,
  } = args;

  useEffect(() => {
    if (!open || facturaId == null || facturaSaldo == null || pagoEditarId) return;
    if (esUsdPagadoEnMxn && tcNum) {
      setMonto((facturaSaldo * tcNum).toFixed(2));
    } else if (!esUsdPagadoEnMxn && moneda === facturaMoneda) {
      setMonto(facturaSaldo.toFixed(2));
    }
  }, [
    esUsdPagadoEnMxn, moneda, facturaId, facturaSaldo, facturaMoneda, tcNum, open,
    pagoEditarId, setMonto,
  ]);
}

/** Argumentos del cálculo de saldo disponible (moneda de la factura). */
export interface SaldoPagoArgs {
  factura: {
    moneda: string;
    saldo: number;
    total: number;
    subtotal: number;
    iva: number;
    ieps: number | null;
    retenciones: number | null;
    fecha_emision: string;
    estado_aprobacion: string | null;
  } | null;
  fecha: string;
  hoy: string;
  montoTexto: string;
  monto: number;
  montoEnMonedaFactura: number;
  moneda: string;
  tcNum: number | null;
  requiereCuenta: boolean;
  diffMxnTexto: string;
  esUsdPagadoEnMxn: boolean;
  modo: "crear" | "editar";
  montoOriginalEnMonedaFactura: number;
}
