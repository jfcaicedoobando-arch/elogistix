/**
 * Datos del reporte de Cartera y Antigüedad: combina CxC (cobranza), CxP
 * (facturas de proveedor) y el TC DOF de la fecha de corte para valuar.
 */
import { useMemo } from "react";
import { useCarteraSnapshot } from "./useCarteraSnapshot";
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
  const snapshot = useCarteraSnapshot();
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
      facturasCarteraDeCobranza(snapshot.data?.cxc ?? []),
      fechaCorte,
      tc,
    );
    return {
      titulo: "Cuentas por cobrar",
      filas,
      buckets: totalesPorBucket(filas),
      total: totalCartera(filas),
    };
  }, [snapshot.data?.cxc, fechaCorte, tc]);

  const bloqueCxp = useMemo<BloqueCartera>(() => {
    const filas = construirFilasCartera(facturasCarteraDeCxp(snapshot.data?.cxp ?? []), fechaCorte, tc);
    return {
      titulo: "Cuentas por pagar",
      filas,
      buckets: totalesPorBucket(filas),
      total: totalCartera(filas),
    };
  }, [snapshot.data?.cxp, fechaCorte, tc]);

  return {
    dataScope: snapshot.data?.scope,
    tc,
    tcLoading: tcQuery.isLoading,
    tcError: tcQuery.isError,
    cxc: useMemo(() => filtrar(bloqueCxc, busqueda), [bloqueCxc, busqueda]),
    cxp: useMemo(() => filtrar(bloqueCxp, busqueda), [bloqueCxp, busqueda]),
    isLoading: snapshot.isLoading || tcQuery.isLoading,
    isError: snapshot.isError || tcQuery.isError,
    refetch: () => {
      void snapshot.refetch();
      void tcQuery.refetch();
    },
  };
}

