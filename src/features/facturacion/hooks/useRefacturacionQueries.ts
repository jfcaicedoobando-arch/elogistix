/**
 * Consultas del asistente de refacturación (caso, factura original, factura
 * nueva y pagos) más el invalidador central de caches.
 *
 * Vive aparte de `useRefacturacion` para mantener ese hook por debajo del
 * límite de complejidad ciclomática (regla Power of 10 / ESLint `complexity`).
 */
import { useCallback } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { facturaNuevaLista } from "../domain/refacturacionEstadoFiscal";
import { estadoFacturaNueva } from "@/features/facturacion/domain/refacturacionNuevaVigencia";
import { queryKeys } from "@/lib/query";
import { usePagosFactura } from "@/features/facturacion/hooks/usePagosFactura";
import {
  obtenerCasoRefacturacion,
  obtenerEstadoFacturaRefacturacion,
  type CasoRefacturacion,
  type FacturaRefacturacionEstado,
} from "@/features/facturacion/services/refacturacion";

/** Lee el cache sin esperar el render/notificador de React Query. */
function leerContexto(qc: QueryClient, facturaId: string | null, activo: boolean) {
  const caso = qc.getQueryState<CasoRefacturacion | null>(queryKeys.facturacion.refacturacionCaso(facturaId));
  const nuevaId = caso?.data?.factura_nueva_id;
  const nueva = qc.getQueryState<FacturaRefacturacionEstado | null>(queryKeys.facturacion.refacturacionFactura(nuevaId));
  return { casoId: caso?.data?.id, nuevaId, lista: facturaNuevaLista(nueva?.data ?? null), estado: estadoFacturaNueva({
    casoDisponible: activo && caso?.status === "success" && Boolean(caso.data),
    casoCargando: caso?.fetchStatus === "fetching", casoError: caso?.status === "error",
    facturaNuevaId: nuevaId, factura: nueva?.data,
    cargando: nueva?.fetchStatus === "fetching", error: nueva?.status === "error",
  }) };
}

export function useRefacturacionQueries(facturaId: string | null, open: boolean) {
  const qc = useQueryClient();
  const activo = open && !!facturaId;
  const leerContextoRefacturacion = useCallback(() => leerContexto(qc, facturaId, activo), [qc, facturaId, activo]);

  const casoQuery = useQuery({
    queryKey: queryKeys.facturacion.refacturacionCaso(facturaId),
    queryFn: () => obtenerCasoRefacturacion(facturaId!),
    enabled: activo,
  });
  const caso: CasoRefacturacion | null = casoQuery.data ?? null;
  const facturaNuevaId = caso?.factura_nueva_id;
  const nuevaActiva = open && !!facturaNuevaId;

  const facturaNuevaQuery = useQuery({
    queryKey: queryKeys.facturacion.refacturacionFactura(facturaNuevaId),
    queryFn: () => obtenerEstadoFacturaRefacturacion(facturaNuevaId!),
    enabled: nuevaActiva,
    refetchInterval: nuevaActiva ? 15_000 : false,
  });

  const originalQuery = useQuery({
    queryKey: queryKeys.facturacion.refacturacionFactura(facturaId),
    queryFn: () => obtenerEstadoFacturaRefacturacion(facturaId!),
    enabled: activo,
  });

  const pagosQuery = usePagosFactura(activo ? facturaId! : undefined, {
    refetchWhileRepPending: open,
  });

  const casoId = caso?.id ?? null;

  const refrescar = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionCaso(facturaId) });
    qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionFacturaPrefix() });
    qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionSimulacionPrefix() });
    // Ola 14 · R5FE-02: consistencia (stale 15 s), expediente y último caso
    // (stale 60 s) también se invalidan; antes quedaban obsoletos tras mutar.
    if (casoId) {
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionConsistencia(casoId) });
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionExpediente(casoId) });
    }
    qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionUltimoCaso(facturaId) });
    qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
    if (facturaId) qc.invalidateQueries({ queryKey: queryKeys.facturas.pagos(facturaId) });
  }, [qc, facturaId, casoId]);

  return {
    caso,
    cargandoCaso: casoQuery.isLoading,
    original: originalQuery.data ?? null,
    facturaNueva: facturaNuevaQuery.data ?? null,
    facturaNuevaCargando: facturaNuevaQuery.isFetching,
    estadoFacturaNueva: estadoFacturaNueva({
      casoDisponible: activo && casoQuery.isSuccess && !!caso,
      casoCargando: casoQuery.isFetching, casoError: casoQuery.isError,
      facturaNuevaId, factura: facturaNuevaQuery.data,
      cargando: facturaNuevaQuery.isFetching, error: facturaNuevaQuery.isError,
    }),
    leerContextoRefacturacion,
    pagos: pagosQuery.data ?? [],
    pagosCargando: pagosQuery.isLoading,
    refrescar,
  };
}
