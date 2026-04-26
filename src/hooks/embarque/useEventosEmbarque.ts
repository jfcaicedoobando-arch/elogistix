import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchEventosEmbarque,
  insertEventoEmbarque,
} from "@/services/embarqueServices";

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

export const TIPOS_EVENTO_TRACKING = [
  "Zarpe",
  "Transbordo",
  "Arribo a Puerto",
  "Descarga",
  "Despacho Aduanal",
  "Liberación",
  "En Ruta Terrestre",
  "Entrega",
  "Demora",
  "Inspección",
  "Otro",
] as const;

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

export function useCreateEventoEmbarque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventoInput) => insertEventoEmbarque(input),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
    },
  });
}
