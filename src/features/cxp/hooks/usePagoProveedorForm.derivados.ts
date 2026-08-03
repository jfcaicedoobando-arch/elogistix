/**
 * Derivados del formulario de pago a proveedor: validación coherente
 * (montos, IVA, totales) y vista previa del impacto. Aplica igual al
 * registrar y al editar un pago existente.
 */
import { useMemo } from "react";
import type { FacturaCxP } from "@/features/cxp/services";
import type { Database } from "@/integrations/supabase/types";
import type { CuentaBancaria } from "@/features/tesoreria";
import {
  validarPagoProveedor,
  type ResultadoValidacionPago,
} from "@/features/cxp/services/pagoProveedorValidaciones";
import { calcularImpactoPago } from "@/features/cxp/services/pagoImpactoPreview";
import { useSaldoProveedorCxp } from "@/features/cxp/hooks/useSaldoProveedorCxp";
import { facturaSinPagoEditado } from "./usePagoProveedorForm.editar";

type Moneda = Database["public"]["Enums"]["moneda"];

export interface DerivadosArgs {
  factura: FacturaCxP | null;
  open: boolean;
  hoy: string;
  fecha: string;
  monto: string;
  montoNum: number;
  montoEnMonedaFactura: number;
  moneda: Moneda;
  tcNum: number | null;
  bloqueadoPorTc: boolean;
  requiereCuenta: boolean;
  cuenta: CuentaBancaria | null;
  diffMxn: string;
  esUsdPagadoEnMxn: boolean;
  modo: "crear" | "editar";
  /** Monto del pago que se está editando, en la moneda de la factura. */
  montoOriginalEnMonedaFactura: number;
}

function etiquetaCuenta(c: CuentaBancaria | null): string | null {
  return c ? `${c.banco} · ${c.alias ?? "Cuenta"} (${c.moneda})` : null;
}

export function usePagoProveedorDerivados(a: DerivadosArgs) {
  const { factura } = a;

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
        fecha: a.fecha,
        hoy: a.hoy,
        montoTexto: a.monto,
        monto: a.montoNum,
        montoEnMonedaFactura: a.montoEnMonedaFactura,
        moneda: a.moneda,
        tcNum: a.tcNum || null,
        bloqueadoPorTc: a.bloqueadoPorTc,
        requiereCuenta: a.requiereCuenta,
        cuenta: a.cuenta
          ? {
              id: a.cuenta.id,
              moneda: a.cuenta.moneda,
              banco: a.cuenta.banco,
              alias: a.cuenta.alias,
            }
          : null,
        diffMxnTexto: a.diffMxn,
        esUsdPagadoEnMxn: a.esUsdPagadoEnMxn,
        modo: a.modo,
        montoOriginalEnMonedaFactura: a.montoOriginalEnMonedaFactura,
      }),
    [
      factura, a.fecha, a.hoy, a.monto, a.montoNum, a.montoEnMonedaFactura, a.moneda,
      a.tcNum, a.bloqueadoPorTc, a.requiereCuenta, a.cuenta, a.diffMxn,
      a.esUsdPagadoEnMxn, a.modo, a.montoOriginalEnMonedaFactura,
    ],
  );

  const saldoProveedor = useSaldoProveedorCxp(
    factura?.proveedor_id ?? null,
    factura?.moneda ?? null,
    a.open,
  );

  const impacto = useMemo(() => {
    if (!factura) return null;
    const base =
      a.modo === "editar"
        ? facturaSinPagoEditado(factura, a.montoOriginalEnMonedaFactura)
        : { saldo: factura.saldo, pagado: factura.pagado };
    const proveedorBase = saldoProveedor.data
      ? {
          ...saldoProveedor.data,
          saldoTotal:
            a.modo === "editar"
              ? saldoProveedor.data.saldoTotal + a.montoOriginalEnMonedaFactura
              : saldoProveedor.data.saldoTotal,
        }
      : null;
    return calcularImpactoPago({
      factura: {
        moneda: factura.moneda,
        saldo: base?.saldo ?? factura.saldo,
        pagado: base?.pagado ?? factura.pagado,
        total: factura.total,
      },
      montoEnMonedaFactura: a.montoEnMonedaFactura,
      monto: a.montoNum,
      monedaPago: a.moneda,
      tcNum: a.tcNum || null,
      bloqueadoPorTc: a.bloqueadoPorTc,
      cuentaEtiqueta: etiquetaCuenta(a.cuenta),
      proveedor: proveedorBase,
    });
  }, [
    factura, a.modo, a.montoOriginalEnMonedaFactura, a.montoEnMonedaFactura,
    a.montoNum, a.moneda, a.tcNum, a.bloqueadoPorTc, a.cuenta, saldoProveedor.data,
  ]);

  return { validacion, impacto, cargandoSaldoProveedor: saldoProveedor.isLoading };
}
