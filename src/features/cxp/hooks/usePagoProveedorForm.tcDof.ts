/**
 * TC del pago tomado del DOF de la fecha de pago (v13.446.0).
 *
 * Política: el tipo de cambio del pago corresponde al DOF del día en que sale
 * el dinero, no al TC con el que se capturó la factura. El campo sigue siendo
 * editable; si el usuario lo escribe a mano, la precarga deja de sobreescribirlo
 * y sólo se ofrece el DOF como sugerencia aplicable con un botón.
 *
 * También sugiere la diferencia cambiaria (TC del pago vs TC de la factura).
 */
import { useCallback, useEffect, useRef } from "react";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";
import { sugerirDiferenciaCambiaria } from "@/features/cxp/services/pagoDiferenciaCambiaria";

export interface TcDofSugerido {
  usdMxn: number;
  /** MNY-NEW-09: paridad aplicable al par de la operación (USD o EUR contra MXN). */
  aplicable: number | null;
  monedaAplicable: string;
  fecha: string;
  exacto: boolean;
}

interface Args {
  open: boolean;
  fecha: string;
  showTc: boolean;
  tc: string;
  setTc: (v: string) => void;
  diffMxn: string;
  setDiffMxn: (v: string) => void;
  esUsdPagadoEnMxn: boolean;
  montoEnMonedaFactura: number;
  /** Divisa del par contra MXN: define si se precarga el DOF USD o el EUR. */
  monedaDelPar: string | null;
  tcFactura: number | null;
  tcNum: number | null;
  pagoEditarId: string | null;
}

export function usePagoTcDof(a: Args) {
  const { open, fecha, showTc, setTc, setDiffMxn } = a;
  const consulta = useTcDofPorFecha(open && showTc ? fecha : null, open && showTc);
  const bruto = consulta.data ?? null;
  // MNY-NEW-09: antes se precargaba SIEMPRE `usdMxn`, incluso en pagos EUR.
  const monedaAplicable = (a.monedaDelPar ?? "USD").toUpperCase();
  const dof: TcDofSugerido | null = bruto
    ? {
        ...bruto,
        monedaAplicable,
        aplicable: monedaAplicable === "EUR" ? bruto.eurMxn ?? null : bruto.usdMxn ?? null,
      }
    : null;

  const tcTocado = useRef(false);
  const diffTocado = useRef(false);

  // Al abrir/cerrar o al cambiar el pago editado se reinician las banderas.
  useEffect(() => {
    tcTocado.current = false;
    diffTocado.current = false;
  }, [open, a.pagoEditarId]);

  const setTcManual = useCallback(
    (v: string) => {
      tcTocado.current = true;
      setTc(v);
    },
    [setTc],
  );

  const setDiffManual = useCallback(
    (v: string) => {
      diffTocado.current = true;
      setDiffMxn(v);
    },
    [setDiffMxn],
  );

  const tcAplicable = dof?.aplicable ?? null;
  const aplicarTcDof = useCallback(() => {
    if (tcAplicable == null) return;
    tcTocado.current = true;
    setTc(String(tcAplicable));
  }, [tcAplicable, setTc]);

  // Precarga del TC con el DOF de la fecha de pago (sólo si no se editó a mano).
  useEffect(() => {
    if (!open || !showTc || tcTocado.current || tcAplicable == null) return;
    setTc(String(tcAplicable));
  }, [open, showTc, tcAplicable, setTc]);

  // Sugerencia de diferencia cambiaria (factura extranjera pagada en MXN).
  useEffect(() => {
    if (!open || !a.esUsdPagadoEnMxn || diffTocado.current) return;
    const sugerida = sugerirDiferenciaCambiaria({
      montoEnMonedaFactura: a.montoEnMonedaFactura,
      tcPago: a.tcNum,
      tcFactura: a.tcFactura,
    });
    setDiffMxn(sugerida == null ? "" : String(sugerida));
  }, [
    open, a.esUsdPagadoEnMxn, a.montoEnMonedaFactura, a.tcNum, a.tcFactura, setDiffMxn,
  ]);

  return {
    tcDof: dof,
    cargandoTcDof: consulta.isLoading,
    setTcManual,
    setDiffManual,
    aplicarTcDof,
  };
}
