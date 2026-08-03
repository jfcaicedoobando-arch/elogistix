/**
 * Estado y validación para DialogRegistrarPagoProveedor.
 * Extraído v12.95.23 para mantener el dialog ≤200 LOC.
 * FIX-14 (auditoría v3): al pagar en MXN una factura USD/EUR, validar
 * y prefilear en la moneda de la factura usando tcValido; sin TC → bloquear.
 */
import { useEffect, useMemo, useState } from "react";
import type { FacturaCxP } from "@/features/cxp/services";
import type { Database } from "@/integrations/supabase/types";
import { defaultMetodo, metodosFor } from "@/features/cxp/components/pagoProveedorHelpers";
import { todayLocalISO } from "@/lib/date/today";
import { tcValido } from "@/lib/financial/tcValido";
import { useCuentasBancarias } from "@/features/tesoreria";
import {
  validarPagoProveedor,
  type ResultadoValidacionPago,
} from "@/features/cxp/services/pagoProveedorValidaciones";

type Moneda = Database["public"]["Enums"]["moneda"];

export function usePagoProveedorForm(factura: FacturaCxP | null, open: boolean) {
  const today = todayLocalISO();

  const [fecha, setFecha] = useState(today);
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("MXN");
  const [tc, setTc] = useState("");
  const [metodo, setMetodo] = useState<string>("Transferencia");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [diffMxn, setDiffMxn] = useState<string>("");
  // R6-N1: cuenta bancaria de donde sale el pago (genera el movimiento bancario).
  const [cuentaId, setCuentaId] = useState<string>("");
  const { data: cuentas = [] } = useCuentasBancarias(true);

  useEffect(() => {
    if (!factura || !open) return;
    setFecha(today);
    setMonto(factura.saldo.toFixed(2));
    setMoneda(factura.moneda);
    setTc(factura.tipo_cambio_usd ? String(factura.tipo_cambio_usd) : "");
    setMetodo(defaultMetodo(factura.proveedor_origen));
    setReferencia("");
    setNotas("");
    setDiffMxn("");
  }, [factura, open, today]);

  const cuentasDeMoneda = useMemo(
    () => cuentas.filter((c) => c.moneda === moneda),
    [cuentas, moneda],
  );

  // Preselección: primera cuenta de la moneda del pago; si no hay, la primera activa.
  useEffect(() => {
    if (!open || cuentaId || cuentas.length === 0) return;
    setCuentaId((cuentasDeMoneda[0] ?? cuentas[0]).id);
  }, [open, cuentaId, cuentas, cuentasDeMoneda]);

  useEffect(() => {
    if (!open) setCuentaId("");
  }, [open]);

  const requiereCuenta = metodo !== "Efectivo";


  const metodosDisponibles = useMemo(
    () => metodosFor(factura?.proveedor_origen ?? null),
    [factura?.proveedor_origen],
  );

  const montoNum = Number(monto) || 0;
  const tcNum = tcValido(tc);
  const monedaFacturaExtranjera = !!factura && factura.moneda !== "MXN";
  const esUsdPagadoEnMxn = monedaFacturaExtranjera && moneda === "MXN";
  const showTc = moneda !== "MXN" || esUsdPagadoEnMxn;

  // Cuando se cambia la moneda de pago a MXN sobre factura extranjera y hay TC,
  // recalcular el prefill del monto para saldar exactamente en MXN.
  const facturaId = factura?.id;
  const facturaSaldo = factura?.saldo;
  const facturaMoneda = factura?.moneda;
  useEffect(() => {
    if (!open || facturaId == null || facturaSaldo == null) return;
    if (esUsdPagadoEnMxn && tcNum) {
      setMonto((facturaSaldo * tcNum).toFixed(2));
    } else if (!esUsdPagadoEnMxn && moneda === facturaMoneda) {
      setMonto(facturaSaldo.toFixed(2));
    }
  }, [esUsdPagadoEnMxn, moneda, facturaId, facturaSaldo, facturaMoneda, tcNum, open]);

  // Monto expresado en la moneda de la factura (para validar contra saldo).
  const montoEnMonedaFactura = useMemo(() => {
    if (!factura) return 0;
    if (moneda === factura.moneda) return montoNum;
    if (esUsdPagadoEnMxn && tcNum) return montoNum / tcNum;
    return montoNum; // otros cruces: se valida en la RPC
  }, [factura, moneda, montoNum, esUsdPagadoEnMxn, tcNum]);

  const saldoRestante = useMemo(
    () => Math.max(0, (factura?.saldo ?? 0) - montoEnMonedaFactura),
    [factura, montoEnMonedaFactura],
  );

  const bloqueadoPorTc = esUsdPagadoEnMxn && !tcNum;
  const excede = factura ? montoEnMonedaFactura > factura.saldo + 0.01 : false;

  const cuentaSeleccionada = useMemo(
    () => cuentas.find((c) => c.id === cuentaId) ?? null,
    [cuentas, cuentaId],
  );

  // R6-N2: validación coherente de montos, IVA y totales antes de guardar.
  const validacion: ResultadoValidacionPago = useMemo(
    () =>
      validarPagoProveedor({
        factura: factura
          ? {
              moneda: factura.moneda,
              saldo: factura.saldo,
              total: factura.total,
              subtotal: factura.subtotal,
              iva: factura.iva,
              ieps: factura.ieps,
              retenciones: factura.retenciones,
              fecha_emision: factura.fecha_emision,
              estado_aprobacion: factura.estado_aprobacion,
            }
          : null,
        fecha,
        hoy: today,
        montoTexto: monto,
        monto: montoNum,
        montoEnMonedaFactura,
        moneda,
        tcNum: tcNum || null,
        bloqueadoPorTc,
        requiereCuenta,
        cuenta: cuentaSeleccionada
          ? {
              id: cuentaSeleccionada.id,
              moneda: cuentaSeleccionada.moneda,
              banco: cuentaSeleccionada.banco,
              alias: cuentaSeleccionada.alias,
            }
          : null,
        diffMxnTexto: diffMxn,
        esUsdPagadoEnMxn,
      }),
    [
      factura, fecha, today, monto, montoNum, montoEnMonedaFactura, moneda,
      tcNum, bloqueadoPorTc, requiereCuenta, cuentaSeleccionada, diffMxn,
      esUsdPagadoEnMxn,
    ],
  );

  return {
    fecha, setFecha, monto, setMonto, moneda, setMoneda,
    tc, setTc, metodo, setMetodo, referencia, setReferencia,
    notas, setNotas, diffMxn, setDiffMxn,
    metodosDisponibles, montoNum, saldoRestante,
    esUsdPagadoEnMxn, showTc, excede,
    montoEnMonedaFactura, bloqueadoPorTc, tcNum,
    cuentas, cuentasDeMoneda, cuentaId, setCuentaId, requiereCuenta,
    cuentaSeleccionada, validacion,

  };
}
