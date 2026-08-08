/**
 * Datos del reporte de Cartera y Antigüedad: combina CxC (cobranza), CxP
 * (facturas de proveedor) y el TC DOF de la fecha de corte para valuar.
 */
import { useMemo } from "react";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";
import {
  construirFilasCartera,
  totalCartera,
  totalesPorBucket,
  type TcCorte,
} from "@/features/reportes/cartera/domain/agingCartera";
import {
  facturasCarteraDeCobranza,
  facturasCarteraDeCxp,
} from "@/features/reportes/cartera/services/carteraExport";
import type { BloqueCartera } from "@/features/reportes/cartera/services/carteraDescargas";

function filtrar(bloque: BloqueCartera, busqueda: string): BloqueCartera {
  const q = busqueda.trim().toLowerCase();
  if (!q) return bloque;
  const filas = bloque.filas.filter(
    (f) =>
      f.contraparte.toLowerCase().includes(q) ||
      f.folio.toLowerCase().includes(q) ||
      f.expediente.toLowerCase().includes(q),
  );
  return { ...bloque, filas, buckets: totalesPorBucket(filas), total: totalCartera(filas) };
}

export function useCarteraAging(fechaCorte: string, busqueda: string) {
  const cxc = useCobranza({});
  const cxp = useFacturasCxP({});
  const tcQuery = useTcDofPorFecha(fechaCorte);

  const tc: TcCorte | null = useMemo(
    () =>
      tcQuery.data
        ? {
            usdMxn: tcQuery.data.usdMxn,
            eurMxn: tcQuery.data.eurMxn,
            fecha: tcQuery.data.fecha,
            exacto: tcQuery.data.exacto,
          }
        : null,
    [tcQuery.data],
  );

  const bloqueCxc = useMemo<BloqueCartera>(() => {
    const filas = construirFilasCartera(
      facturasCarteraDeCobranza(cxc.data ?? []),
      fechaCorte,
      tc,
    );
    return {
      titulo: "Cuentas por cobrar",
      filas,
      buckets: totalesPorBucket(filas),
      total: totalCartera(filas),
    };
  }, [cxc.data, fechaCorte, tc]);

  const bloqueCxp = useMemo<BloqueCartera>(() => {
    const filas = construirFilasCartera(facturasCarteraDeCxp(cxp.data ?? []), fechaCorte, tc);
    return {
      titulo: "Cuentas por pagar",
      filas,
      buckets: totalesPorBucket(filas),
      total: totalCartera(filas),
    };
  }, [cxp.data, fechaCorte, tc]);

  return {
    tc,
    tcLoading: tcQuery.isLoading,
    cxc: useMemo(() => filtrar(bloqueCxc, busqueda), [bloqueCxc, busqueda]),
    cxp: useMemo(() => filtrar(bloqueCxp, busqueda), [bloqueCxp, busqueda]),
    isLoading: cxc.isLoading || cxp.isLoading,
    isError: cxc.isError || cxp.isError,
    refetch: () => {
      void cxc.refetch();
      void cxp.refetch();
    },
  };
}
