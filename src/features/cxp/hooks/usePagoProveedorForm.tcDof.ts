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
  tcFactura: number | null;
  tcNum: number | null;
  pagoEditarId: string | null;
}

export function usePagoTcDof(a: Args) {
  const { open, fecha, showTc, setTc, setDiffMxn } = a;
  const consulta = useTcDofPorFecha(open && showTc ? fecha : null, open && showTc);
  const dof = consulta.data ?? null;

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

  const aplicarTcDof = useCallback(() => {
    if (!dof) return;
    tcTocado.current = true;
    setTc(String(dof.usdMxn));
  }, [dof, setTc]);

  // Precarga del TC con el DOF de la fecha de pago (sólo si no se editó a mano).
  useEffect(() => {
    if (!open || !showTc || tcTocado.current || !dof) return;
    setTc(String(dof.usdMxn));
  }, [open, showTc, dof, setTc]);

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
    tcDof: dof as TcDofSugerido | null,
    cargandoTcDof: consulta.isLoading,
    setTcManual,
    setDiffManual,
    aplicarTcDof,
  };
}
