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


/** Convierte un prospecto en cliente y actualiza la cotización */
export function useConvertirProspectoACliente() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({
      cotizacionId,
      clienteData,
    }: Omit<ProspectoAClienteInput, 'user'>) =>
      convertirProspectoACliente({ cotizacionId, clienteData, user }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
      notifySuccess(undefined, { title: "Prospecto convertido a cliente" });
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
