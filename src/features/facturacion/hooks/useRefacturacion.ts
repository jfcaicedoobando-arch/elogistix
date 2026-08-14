/**
 * Estado del asistente "Refacturar a otro receptor" (5 pasos).
 *
 * Une el caso persistido en BD (`refacturaciones`) con el estado de la factura
 * nueva y los pagos de la original, para que el wizard pueda validar cada
 * etapa antes de permitir avanzar.
 */
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { usePagosFactura } from "@/features/facturacion/hooks/usePagosFactura";
import {
  abrirCasoRefacturacion,
  avanzarPasoRefacturacion,
  cerrarCasoRefacturacion,
  duplicarFacturaParaRefacturacion,
  obtenerCasoRefacturacion,
  obtenerEstadoFacturaRefacturacion,
  reasignarPagoFactura,
  type AbrirCasoInput,
  type CasoRefacturacion,
  type ReasignarPagoInput,
} from "@/features/facturacion/services/refacturacion";

function fail(title: string, error: Error) {
  notifyError(undefined, {
    title,
    description: getErrorMessage(error),
    error,
    method: "FEATURES_FACTURACION_REFACTURACION",
  });
}

export function useRefacturacion(facturaId: string | null, open: boolean) {
  const qc = useQueryClient();
  const [paso, setPaso] = useState(1);

  const casoQuery = useQuery({
    queryKey: queryKeys.facturacion.refacturacionCaso(facturaId),
    queryFn: () => obtenerCasoRefacturacion(facturaId!),
    enabled: open && !!facturaId,
  });
  const caso: CasoRefacturacion | null = casoQuery.data ?? null;

  const facturaNuevaQuery = useQuery({
    queryKey: queryKeys.facturacion.refacturacionFactura(caso?.factura_nueva_id ?? null),
    queryFn: () => obtenerEstadoFacturaRefacturacion(caso!.factura_nueva_id!),
    enabled: open && !!caso?.factura_nueva_id,
    refetchInterval: open && !!caso?.factura_nueva_id ? 15_000 : false,
  });

  const originalQuery = useQuery({
    queryKey: queryKeys.facturacion.refacturacionFactura(facturaId),
    queryFn: () => obtenerEstadoFacturaRefacturacion(facturaId!),
    enabled: open && !!facturaId,
  });

  const pagosQuery = usePagosFactura(open && facturaId ? facturaId : undefined, {
    refetchWhileRepPending: open,
  });

  // El caso manda: al reabrir el modal el usuario retoma donde se quedó.
  useEffect(() => {
    if (!open) return;
    setPaso(caso ? Math.min(Math.max(caso.paso_actual, 1), 5) : 1);
  }, [open, caso]);

  const refrescar = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionCaso(facturaId) });
    qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionFacturaPrefix() });
    qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionSimulacionPrefix() });
    // Ola 14 · R5FE-02: consistencia (stale 15 s), expediente y último caso
    // (stale 60 s) también se invalidan; antes quedaban obsoletos tras mutar.
    if (caso?.id) {
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionConsistencia(caso.id) });
      qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionExpediente(caso.id) });
    }
    qc.invalidateQueries({ queryKey: queryKeys.facturacion.refacturacionUltimoCaso(facturaId) });
    qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
    if (facturaId) qc.invalidateQueries({ queryKey: queryKeys.facturas.pagos(facturaId) });
  }, [qc, facturaId, caso?.id]);

  const abrir = useMutation({
    mutationFn: (input: AbrirCasoInput) => abrirCasoRefacturacion(input),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Caso de refacturación abierto" });
      refrescar();
      setPaso(2);
    },
    onError: (e: Error) => fail("No se pudo abrir el caso", e),
  });

  const avanzar = useMutation({
    mutationFn: (destino: number) => avanzarPasoRefacturacion(caso!.id, destino),
    onSuccess: (_d, destino) => {
      setPaso(destino);
      refrescar();
    },
    onError: (e: Error) => fail("No se pudo avanzar el paso", e),
  });

  const duplicar = useMutation({
    mutationFn: () => duplicarFacturaParaRefacturacion(caso!.id),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Borrador creado para el cliente destino" });
      refrescar();
    },
    onError: (e: Error) => fail("No se pudo crear el borrador", e),
  });

  const reasignar = useMutation({
    mutationFn: (input: ReasignarPagoInput) => reasignarPagoFactura(input),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Pago reasignado a la nueva factura" });
      refrescar();
    },
    onError: (e: Error) => fail("No se pudo reasignar el pago", e),
  });

  const cerrar = useMutation({
    mutationFn: (cancelar: boolean) => cerrarCasoRefacturacion(caso!.id, cancelar),
    onSuccess: (_d, cancelar) => {
      notifySuccess(undefined, {
        title: cancelar ? "Caso cancelado" : "Refacturación completada",
      });
      refrescar();
    },
    onError: (e: Error) => fail("No se pudo cerrar el caso", e),
  });

  return {
    paso,
    setPaso,
    caso,
    cargandoCaso: casoQuery.isLoading,
    original: originalQuery.data ?? null,
    facturaNueva: facturaNuevaQuery.data ?? null,
    facturaNuevaCargando: facturaNuevaQuery.isFetching,
    pagos: pagosQuery.data ?? [],
    pagosCargando: pagosQuery.isLoading,
    refrescar,
    abrir,
    avanzar,
    duplicar,
    reasignar,
    cerrar,
  };
}
