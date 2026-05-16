/**
 * Mutations: creación de embarques.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query';
import { crearEmbarqueRpc, duplicarEmbarqueRpc } from '@/services/embarque';
import { fromDb } from "@/lib/supabase/cast";

type EmbarqueRow = Tables<'embarques'>;

interface CreateEmbarqueInput {
  embarque: TablesInsert<'embarques'>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
  documentos: Omit<TablesInsert<'documentos_embarque'>, 'embarque_id'>[];
  /** Idempotency key (A.3). Si se omite, se genera uno automáticamente. */
  requestId?: string;
}

export function useCreateEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEmbarqueInput) => {
      const result = await crearEmbarqueRpc(input);
      return fromDb<EmbarqueRow>({ id: result.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
  });
}

interface DuplicarEmbarqueInput {
  embarqueOrigen: EmbarqueRow;
  copias: Array<{
    num_contenedor: string;
    tipo_contenedor: string;
    peso_kg: number;
    volumen_m3: number;
    piezas: number;
  }>;
}

export function useDuplicarEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueOrigen, copias }: DuplicarEmbarqueInput) =>
      duplicarEmbarqueRpc(embarqueOrigen.id, copias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
    },
  });
}
