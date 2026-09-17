/**
 * Estado y validación para registrar y EDITAR un pago a proveedor.
 * Extraído v12.95.23 para mantener el dialog ≤200 LOC.
 * FIX-14 (auditoría v3): al pagar en MXN una factura USD/EUR, validar
 * y prefilear en la moneda de la factura usando tcValido; sin TC → bloquear.
 * v13.395.0: soporta modo edición (`pagoEditar`) con las mismas validaciones,
 * devolviendo al saldo el importe del pago original.
 */
import { useCallback, useMemo } from "react";
import { useCamposTocadosPago } from "./usePagoProveedorForm.tocados";

import type { FacturaCxP } from "@/features/cxp/services";
import { metodosFor } from "@/features/cxp/components/pagoProveedorHelpers";
import { todayLocalISO } from "@/lib/date/today";
import { tcValido } from "@/lib/financial/tcValido";
import { useCuentasBancarias } from "@/features/tesoreria";
import { saldoDisponiblePago } from "@/features/cxp/services/pagoProveedorValidaciones";
import { banderasMonedaPago, facturaSaldoInput } from "./usePagoProveedorForm.saldoInput";
import { usePagoProveedorDerivados } from "./usePagoProveedorForm.derivados";
import { usePagoProveedorCampos } from "./usePagoProveedorForm.estado";
import { usePagoTcDof } from "./usePagoProveedorForm.tcDof";
import {
  useCuentaPagoSeleccionada,
  usePrefillMontoPago,
} from "./usePagoProveedorForm.cuentas";
import {
  montoOriginalEnMonedaFactura as calcMontoOriginal,
  montoEnMonedaDeFactura,
  type PagoEditable,
} from "./usePagoProveedorForm.editar";

export function usePagoProveedorForm(
  factura: FacturaCxP | null,
  open: boolean,
  pagoEditar: PagoEditable | null = null,
) {
  const today = todayLocalISO();
  const modo: "crear" | "editar" = pagoEditar ? "editar" : "crear";

  const {
    fecha, setFecha, monto, setMonto, moneda, setMoneda, tc, setTc,
    metodo, setMetodo, referencia, setReferencia, notas, setNotas,
    diffMxn, setDiffMxn, cuentaId, setCuentaId, pagoEditarId, valoresIniciales,
  } = usePagoProveedorCampos(factura, open, today, pagoEditar);


  // R6-N1: cuenta bancaria de donde sale el pago (genera el movimiento bancario).
  const { data: cuentas = [] } = useCuentasBancarias(true);


  // MNY: en efectivo NO se usa cuenta bancaria (no hay salida de banco).
  const requiereCuenta = metodo !== "Efectivo";

  const { cuentasDeMoneda, cuentaSeleccionada } = useCuentaPagoSeleccionada({
    cuentas, moneda, open, cuentaId, setCuentaId, pagoEditarId, requiereCuenta,
  });



  const metodosDisponibles = useMemo(
    () => metodosFor(factura?.proveedor_origen ?? null),
    [factura?.proveedor_origen],
  );

  const tcNum = tcValido(tc);
  const {
    montoNum, esUsdPagadoEnMxn, showTc, bloqueadoPorTc, cruceNoSoportado, monedaDelPar,
    soportaDiferenciaCambiaria,
  } = banderasMonedaPago({
    factura, moneda, monto, tcNum,
  });


  // Cuando se cambia la moneda de pago a MXN sobre factura extranjera y hay TC,
  // recalcular el prefill del monto para saldar exactamente en MXN.
  // En edición NO se reescribe el monto capturado por el usuario.
  const facturaId = factura?.id;
  const facturaSaldo = factura?.saldo;
  const facturaMoneda = factura?.moneda;
  usePrefillMontoPago({
    open, facturaId, facturaSaldo, facturaMoneda, moneda,
    esUsdPagadoEnMxn, tcNum, pagoEditarId, setMonto,
  });

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

  // v13.446.0: el TC del pago proviene del DOF de la fecha de pago (editable).
  const {
    tcDof, cargandoTcDof, setTcManual, setDiffManual, aplicarTcDof,
  } = usePagoTcDof({
    open, fecha, showTc, tc, setTc, diffMxn, setDiffMxn, esUsdPagadoEnMxn,
    montoEnMonedaFactura, tcFactura: tcValido(factura?.tipo_cambio_usd), tcNum,
    pagoEditarId, monedaDelPar,
  });

  // Al editar, el importe del pago original vuelve al saldo disponible.
  const montoOriginalEnMonedaFactura = useMemo(
    () => calcMontoOriginal(pagoEditar, factura?.moneda),
    [pagoEditar, factura?.moneda],
  );


  const facturaParaSaldo = useMemo(
    () => (factura ? facturaSaldoInput(factura) : null),
    [factura],
  );

  const saldoDisponible = useMemo(
    () =>
      saldoDisponiblePago({
        factura: facturaParaSaldo,
        fecha, hoy: today, montoTexto: monto, monto: montoNum, montoEnMonedaFactura,
        moneda, tcNum, bloqueadoPorTc: false, requiereCuenta, cuenta: null,
        diffMxnTexto: diffMxn, esUsdPagadoEnMxn, modo, montoOriginalEnMonedaFactura,
      }),
    [
      facturaParaSaldo, fecha, today, monto, montoNum, montoEnMonedaFactura, moneda, tcNum,
      requiereCuenta, diffMxn, esUsdPagadoEnMxn, modo, montoOriginalEnMonedaFactura,
    ],
  );

  const saldoRestante = useMemo(
    () => Math.max(0, saldoDisponible - montoEnMonedaFactura),
    [saldoDisponible, montoEnMonedaFactura],
  );

  const excede = factura ? montoEnMonedaFactura > saldoDisponible + 0.01 : false;

  // R6-N2: validación coherente de montos, IVA y totales antes de guardar
  // (aplica igual al registrar y al editar).
  const { validacion, impacto, cargandoSaldoProveedor } = usePagoProveedorDerivados({
    factura, open, hoy: today, fecha, monto, montoNum, montoEnMonedaFactura, moneda,
    tcNum, bloqueadoPorTc, requiereCuenta, cuenta: cuentaSeleccionada, diffMxn,
    esUsdPagadoEnMxn, modo, montoOriginalEnMonedaFactura,
  });

  // MNY: qué campos con precarga automática tocó el usuario (aviso de descarte).
  const { tocados, marcar } = useCamposTocadosPago(open, pagoEditarId);
  const setTcUi = useCallback((v: string) => { marcar("tc"); setTcManual(v); }, [marcar, setTcManual]);
  const setDiffUi = useCallback((v: string) => { marcar("diffMxn"); setDiffManual(v); }, [marcar, setDiffManual]);
  const setCuentaIdUi = useCallback((v: string) => { marcar("cuentaId"); setCuentaId(v); }, [marcar, setCuentaId]);



  return {
    fecha, setFecha, monto, setMonto, moneda, setMoneda,
    tc, setTc: setTcUi, metodo, setMetodo, referencia, setReferencia,
    notas, setNotas, diffMxn, setDiffMxn: setDiffUi,
    metodosDisponibles, montoNum, saldoRestante, saldoDisponible,
    esUsdPagadoEnMxn, showTc, excede, cruceNoSoportado, monedaDelPar,
    montoEnMonedaFactura, bloqueadoPorTc, tcNum,
    cuentas, cuentasDeMoneda, cuentaId, setCuentaId: setCuentaIdUi, requiereCuenta,
    /** MNY: campos con precarga automática que el usuario ya tocó a mano. */
    tocados,

    cuentaSeleccionada, validacion, modo, montoOriginalEnMonedaFactura,
    impacto, cargandoSaldoProveedor,
    tcDof, cargandoTcDof, aplicarTcDof,
    soportaDiferenciaCambiaria,
    /** MNY: valores con los que abrió el formulario (baseline de "sin cambios"). */
    valoresIniciales,
    /**
     * MNY: cuenta que se envía a la RPC. En efectivo es `null` para que la base
     * no derive un cargo bancario.
     */
    cuentaBancariaIdEnvio: requiereCuenta ? cuentaId || null : null,
    /** MNY: diferencia cambiaria sólo cuando el par USD/MXN la soporta. */
    diferenciaCambiariaEnvio:
      soportaDiferenciaCambiaria && diffMxn !== "" ? Number(diffMxn) : null,
  };


}

export type { PagoEditable };
