/**
 * Consultas del asistente de refacturación (caso, factura original, factura
 * nueva y pagos) más el invalidador central de caches.
 *
 * Vive aparte de `useRefacturacion` para mantener ese hook por debajo del
 * límite de complejidad ciclomática (regla Power of 10 / ESLint `complexity`).
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { usePagosFactura } from "@/features/facturacion/hooks/usePagosFactura";
import {
  obtenerCasoRefacturacion,
  obtenerEstadoFacturaRefacturacion,
  type CasoRefacturacion,
} from "@/features/facturacion/services/refacturacion";

export function useRefacturacionQueries(facturaId: string | null, open: boolean) {
  const qc = useQueryClient();
  const activo = open && !!facturaId;

  const casoQuery = useQuery({
    queryKey: queryKeys.facturacion.refacturacionCaso(facturaId),
    queryFn: () => obtenerCasoRefacturacion(facturaId!),
    enabled: activo,
  });
  const caso: CasoRefacturacion | null = casoQuery.data ?? null;
  const facturaNuevaId = caso?.factura_nueva_id ?? null;
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
    pagos: pagosQuery.data ?? [],
    pagosCargando: pagosQuery.isLoading,
    refrescar,
  };
}
