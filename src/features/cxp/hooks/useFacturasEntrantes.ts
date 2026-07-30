/**
 * Hooks de react-query para el buzón de facturas de proveedor (CxP Inbox).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  capturarFacturaEntrante,
  eliminarFacturaEntrante,
  listarFacturasEntrantesPendientes,
  listarFacturasEntrantesPorEmbarque,
  rechazarFacturaEntrante,
  subirFacturaEntrante,
  type FacturaEntranteRow,
  type SubirFacturaEntranteInput,
} from "@/features/cxp/services/facturasEntrantes";

export const QK_ENTRANTES = "facturas-entrantes";

export function useFacturasEntrantes(embarqueId: string) {
  return useQuery({
    queryKey: [QK_ENTRANTES, "embarque", embarqueId],
    queryFn: () => listarFacturasEntrantesPorEmbarque(embarqueId),
    enabled: Boolean(embarqueId),
  });
}

export function useFacturasEntrantesPendientes() {
  return useQuery({
    queryKey: [QK_ENTRANTES, "pendientes"],
    queryFn: () => listarFacturasEntrantesPendientes(),
  });
}

function useInvalidarEntrantes() {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: [QK_ENTRANTES] }); };
}

export function useSubirFacturaEntrante() {
  const invalidar = useInvalidarEntrantes();
  return useMutation({
    mutationFn: (input: SubirFacturaEntranteInput) => subirFacturaEntrante(input),
    onSuccess: () => {
      invalidar();
      notifySuccess(undefined, {
        title: "Factura enviada al buzón",
        description: "Contabilidad la verá en su bandeja para capturarla.",
      });
    },
    onError: (error) => notifyError(undefined, {
      title: "No se pudo subir la factura",
      error,
      method: "SUBIR_FACTURA_ENTRANTE",
    }),
  });
}

export function useEliminarFacturaEntrante() {
  const invalidar = useInvalidarEntrantes();
  return useMutation({
    mutationFn: (row: Pick<FacturaEntranteRow, "id" | "archivo_path">) => eliminarFacturaEntrante(row),
    onSuccess: () => {
      invalidar();
      notifySuccess(undefined, { title: "Archivo retirado del buzón" });
    },
    onError: (error) => notifyError(undefined, {
      title: "No se pudo retirar el archivo",
      error,
      method: "ELIMINAR_FACTURA_ENTRANTE",
    }),
  });
}

export function useRechazarFacturaEntrante() {
  const invalidar = useInvalidarEntrantes();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => rechazarFacturaEntrante(id, motivo),
    onSuccess: () => {
      invalidar();
      notifySuccess(undefined, {
        title: "Documento rechazado",
        description: "Operación verá el motivo en el buzón del embarque.",
      });
    },
    onError: (error) => notifyError(undefined, {
      title: "No se pudo rechazar el documento",
      error,
      method: "RECHAZAR_FACTURA_ENTRANTE",
    }),
  });
}

export function useCapturarFacturaEntrante() {
  const invalidar = useInvalidarEntrantes();
  return useMutation({
    mutationFn: ({ id, facturaId }: { id: string; facturaId: string }) =>
      capturarFacturaEntrante(id, facturaId),
    onSuccess: () => {
      invalidar();
      notifySuccess(undefined, { title: "Documento marcado como capturado" });
    },
    onError: (error) => notifyError(undefined, {
      title: "No se pudo marcar como capturado",
      error,
      method: "CAPTURAR_FACTURA_ENTRANTE",
    }),
  });
}
