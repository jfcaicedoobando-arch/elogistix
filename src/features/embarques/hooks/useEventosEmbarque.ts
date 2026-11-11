import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchEventosEmbarque } from "@/features/embarques/services";

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
