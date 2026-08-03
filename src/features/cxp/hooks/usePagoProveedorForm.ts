/**
 * Estado y validación para registrar y EDITAR un pago a proveedor.
 * Extraído v12.95.23 para mantener el dialog ≤200 LOC.
 * FIX-14 (auditoría v3): al pagar en MXN una factura USD/EUR, validar
 * y prefilear en la moneda de la factura usando tcValido; sin TC → bloquear.
 * v13.395.0: soporta modo edición (`pagoEditar`) con las mismas validaciones,
 * devolviendo al saldo el importe del pago original.
 */
import { useEffect, useMemo, useState } from "react";
import type { FacturaCxP } from "@/features/cxp/services";
import type { Database } from "@/integrations/supabase/types";
import { defaultMetodo, metodosFor } from "@/features/cxp/components/pagoProveedorHelpers";
import { todayLocalISO } from "@/lib/date/today";
import { tcValido } from "@/lib/financial/tcValido";
import { useCuentasBancarias } from "@/features/tesoreria";
import { saldoDisponiblePago } from "@/features/cxp/services/pagoProveedorValidaciones";
import { usePagoProveedorDerivados } from "./usePagoProveedorForm.derivados";
import {
  montoOriginalEnMonedaFactura as calcMontoOriginal,
  montoEnMonedaDeFactura,
  valoresInicialesCreacion,
  valoresInicialesEdicion,
  type PagoEditable,
} from "./usePagoProveedorForm.editar";

type Moneda = Database["public"]["Enums"]["moneda"];

export function usePagoProveedorForm(
  factura: FacturaCxP | null,
  open: boolean,
  pagoEditar: PagoEditable | null = null,
) {
  const today = todayLocalISO();
  const modo: "crear" | "editar" = pagoEditar ? "editar" : "crear";

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

  const pagoEditarId = pagoEditar?.id ?? null;

  useEffect(() => {
    if (!factura || !open) return;
    const v = pagoEditar
      ? valoresInicialesEdicion(pagoEditar)
      : valoresInicialesCreacion(factura, today, defaultMetodo(factura.proveedor_origen));
    setFecha(v.fecha);
    setMonto(v.monto);
    setMoneda(v.moneda);
    setTc(v.tc);
    setMetodo(v.metodo);
    setReferencia(v.referencia);
    setNotas(v.notas);
    setDiffMxn(v.diffMxn);
    if (pagoEditar) setCuentaId(v.cuentaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factura, open, today, pagoEditarId]);

  const cuentasDeMoneda = useMemo(
    () => cuentas.filter((c) => c.moneda === moneda),
    [cuentas, moneda],
  );

  // Preselección: primera cuenta de la moneda del pago; si no hay, la primera activa.
  useEffect(() => {
    if (!open || cuentaId || cuentas.length === 0 || pagoEditarId) return;
    setCuentaId((cuentasDeMoneda[0] ?? cuentas[0]).id);
  }, [open, cuentaId, cuentas, cuentasDeMoneda, pagoEditarId]);

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
  // En edición NO se reescribe el monto capturado por el usuario.
  const facturaId = factura?.id;
  const facturaSaldo = factura?.saldo;
  const facturaMoneda = factura?.moneda;
  useEffect(() => {
    if (!open || facturaId == null || facturaSaldo == null || pagoEditarId) return;
    if (esUsdPagadoEnMxn && tcNum) {
      setMonto((facturaSaldo * tcNum).toFixed(2));
    } else if (!esUsdPagadoEnMxn && moneda === facturaMoneda) {
      setMonto(facturaSaldo.toFixed(2));
    }
  }, [esUsdPagadoEnMxn, moneda, facturaId, facturaSaldo, facturaMoneda, tcNum, open, pagoEditarId]);

  // Monto expresado en la moneda de la factura (para validar contra saldo).
  const montoEnMonedaFactura = useMemo(
    () =>
      montoEnMonedaDeFactura({
        monedaFactura: factura?.moneda ?? null,
        monedaPago: moneda,
        monto: montoNum,
        tcNum,
      }),
    [factura?.moneda, moneda, montoNum, tcNum],
  );

  // Al editar, el importe del pago original vuelve al saldo disponible.
  const montoOriginalEnMonedaFactura = useMemo(
    () => calcMontoOriginal(pagoEditar, factura?.moneda),
    [pagoEditar, factura?.moneda],
  );

  const saldoDisponible = useMemo(
    () =>
      saldoDisponiblePago({
        factura: factura
          ? {
              moneda: factura.moneda, saldo: factura.saldo, total: factura.total,
              subtotal: factura.subtotal, iva: factura.iva, ieps: factura.ieps,
              retenciones: factura.retenciones, fecha_emision: factura.fecha_emision,
              estado_aprobacion: factura.estado_aprobacion,
            }
          : null,
        fecha, hoy: today, montoTexto: monto, monto: montoNum, montoEnMonedaFactura,
        moneda, tcNum, bloqueadoPorTc: false, requiereCuenta, cuenta: null,
        diffMxnTexto: diffMxn, esUsdPagadoEnMxn, modo, montoOriginalEnMonedaFactura,
      }),
    [
      factura, fecha, today, monto, montoNum, montoEnMonedaFactura, moneda, tcNum,
      requiereCuenta, diffMxn, esUsdPagadoEnMxn, modo, montoOriginalEnMonedaFactura,
    ],
  );

  const saldoRestante = useMemo(
    () => Math.max(0, saldoDisponible - montoEnMonedaFactura),
    [saldoDisponible, montoEnMonedaFactura],
  );

  const bloqueadoPorTc = esUsdPagadoEnMxn && !tcNum;
  const excede = factura ? montoEnMonedaFactura > saldoDisponible + 0.01 : false;

  const cuentaSeleccionada = useMemo(
    () => cuentas.find((c) => c.id === cuentaId) ?? null,
    [cuentas, cuentaId],
  );

  // R6-N2: validación coherente de montos, IVA y totales antes de guardar
  // (aplica igual al registrar y al editar).
  const { validacion, impacto, cargandoSaldoProveedor } = usePagoProveedorDerivados({
    factura, open, hoy: today, fecha, monto, montoNum, montoEnMonedaFactura, moneda,
    tcNum, bloqueadoPorTc, requiereCuenta, cuenta: cuentaSeleccionada, diffMxn,
    esUsdPagadoEnMxn, modo, montoOriginalEnMonedaFactura,
  });

  return {
    fecha, setFecha, monto, setMonto, moneda, setMoneda,
    tc, setTc, metodo, setMetodo, referencia, setReferencia,
    notas, setNotas, diffMxn, setDiffMxn,
    metodosDisponibles, montoNum, saldoRestante, saldoDisponible,
    esUsdPagadoEnMxn, showTc, excede,
    montoEnMonedaFactura, bloqueadoPorTc, tcNum,
    cuentas, cuentasDeMoneda, cuentaId, setCuentaId, requiereCuenta,
    cuentaSeleccionada, validacion, modo, montoOriginalEnMonedaFactura,
    impacto, cargandoSaldoProveedor,
  };
}

export type { PagoEditable };
