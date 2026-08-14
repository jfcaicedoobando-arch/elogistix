/**
 * Estado del asistente "Refacturar a otro receptor" (5 pasos).
 *
 * Une el caso persistido en BD (`refacturaciones`) con el estado de la factura
 * nueva y los pagos de la original, para que el wizard pueda validar cada
 * etapa antes de permitir avanzar. Las consultas viven en
 * `useRefacturacionQueries`; aquí sólo quedan el paso y las mutaciones.
 */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { useRefacturacionQueries } from "@/features/facturacion/hooks/useRefacturacionQueries";
import {
  abrirCasoRefacturacion,
  avanzarPasoRefacturacion,
  cerrarCasoRefacturacion,
  duplicarFacturaParaRefacturacion,
  reasignarPagoFactura,
  type AbrirCasoInput,
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
  const [paso, setPaso] = useState(1);
  const datos = useRefacturacionQueries(facturaId, open);
  const { caso, refrescar } = datos;

  // El caso manda: al reabrir el modal el usuario retoma donde se quedó.
  useEffect(() => {
    if (!open) return;
    setPaso(caso ? Math.min(Math.max(caso.paso_actual, 1), 5) : 1);
  }, [open, caso]);

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
    cargandoCaso: datos.cargandoCaso,
    original: datos.original,
    facturaNueva: datos.facturaNueva,
    facturaNuevaCargando: datos.facturaNuevaCargando,
    pagos: datos.pagos,
    pagosCargando: datos.pagosCargando,
    refrescar,
    abrir,
    avanzar,
    duplicar,
    reasignar,
    cerrar,
  };
}
