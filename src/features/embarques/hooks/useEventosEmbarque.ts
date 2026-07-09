import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchEventosEmbarque,
  insertEventoEmbarque,
} from "@/features/embarques/services";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

export interface EventoEmbarque {
  id: string;
  embarque_id: string;
  tipo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;
  usuario: string;
  created_at: string;
}


export function useEventosEmbarque(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.eventos(embarqueId!),
    queryFn: () => fetchEventosEmbarque(embarqueId!),
    enabled: !!embarqueId,
  });
}

interface CreateEventoInput {
  embarqueId: string;
  tipo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;
  usuario: string;
}

interface CreateEventoOptions {
  /** Si es true, no dispara toasts internos (éxito ni error). El caller es responsable de notificar. */
  silent?: boolean;
}

export function useCreateEventoEmbarque(options: CreateEventoOptions = {}) {
  const { silent = false } = options;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventoInput) => insertEventoEmbarque(input),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
      if (!silent) notifySuccess(undefined, { title: "Evento agregado" });
    },
    onError: (error: Error) => {
      if (silent) return;
      notifyError(undefined, { title: `Error al agregar evento: ${error.message}`, error, method: "CREATE_EVENTO_EMBARQUE" });
    },
  });
}
