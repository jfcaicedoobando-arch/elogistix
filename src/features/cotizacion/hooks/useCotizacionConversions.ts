import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  convertirProspectoACliente,
  crearEmbarqueBorradorDesdeCotizacion,
  type ProspectoAClienteInput,
} from '@/features/cotizacion/services';
import { notifyError, notifySuccess } from '@/lib/ui/appFeedback';
import { RevalidacionRequeridaError } from '@/features/cotizacion/domain/revalidacionTarifa';
import { getErrorMessage } from "@/lib/errors";


/**
 * Convierte un prospecto en cliente (una sola RPC atómica).
 *
 * P0 — `onSuccess` es `async`: las invalidaciones se resuelven ANTES de que el
 * handler cierre el diálogo, para que la pantalla ya muestre el cliente ligado.
 */
export function useConvertirProspectoACliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cotizacionId, clienteData }: ProspectoAClienteInput) =>
      convertirProspectoACliente({ cotizacionId, clienteData }),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.cotizaciones.detail(variables.cotizacionId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.crm.all }),
      ]);
      notifySuccess(undefined, {
        title: "Cliente listo",
        description: "Ya puedes crear el embarque de esta cotización.",
      });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo convertir prospecto", description: getErrorMessage(error), error, method: "CONVERT_PROSPECTO_CLIENTE" });
    },
  });
}

// FIX-07 (v13.303.12) — La mutación legacy `useConvertirCotizacionAEmbarques`
// (6 awaits sin transacción desde el cliente) se eliminó. Toda conversión
// pasa por `useCrearEmbarqueBorrador`, que llama a la RPC transaccional
// `crear_embarque_borrador_desde_cotizacion(uuid)` (idempotente + protegida
// por el índice único `uq_cotizaciones_embarque_unico`).

/** Crea un embarque borrador (1 clic) desde una cotización Aceptada vía RPC. */
export function useCrearEmbarqueBorrador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cotizacionId: string) => crearEmbarqueBorradorDesdeCotizacion(cotizacionId),
    onSuccess: (_embarqueId, cotizacionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(cotizacionId) });
      notifySuccess(undefined, {
        title: "Embarque borrador creado",
        description: "Complétalo y confírmalo cuando esté listo.",
      });
    },
    onError: (error: Error) => {
      // La revalidación de tarifa la comunica el handler con su propio aviso
      // guiado (mantener/refrescar/sustituir); no duplicamos toast aquí.
      if (error instanceof RevalidacionRequeridaError) return;
      notifyError(undefined, { title: "No se pudo crear embarque borrador", description: getErrorMessage(error), error, method: "CREATE_EMBARQUE_BORRADOR" });
    },
  });
}
