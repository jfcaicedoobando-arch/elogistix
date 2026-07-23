/**
 * Mutations: creación de embarques.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query';
import { crearEmbarqueRpc, duplicarEmbarqueRpc } from '@/features/embarques/services';
import { crearMuchos } from '@/features/embarques/services/contenedores';
import { fromDb } from "@/lib/supabase/cast";
import { newRequestId } from "@/lib/idempotency";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { ContenedorBorrador } from "@/features/embarques/types/contenedor";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";

type EmbarqueRow = Tables<'embarques'>;

interface CreateEmbarqueInput {
  embarque: TablesInsert<'embarques'>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
  documentos: Omit<TablesInsert<'documentos_embarque'>, 'embarque_id'>[];
  /** Contenedores hijos a insertar tras crear el embarque (Fase G v12.8.0). */
  contenedores?: ContenedorBorrador[];
  /** Idempotency key (A.3). Si se omite, se genera uno automáticamente. */
  requestId?: string;
}

export function useCreateEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEmbarqueInput) => {
      const requestId = input.requestId ?? newRequestId();
      const { contenedores, ...rest } = input;
      const result = await crearEmbarqueRpc({ ...rest, requestId });
      // Insertar contenedores hijos (no bloqueante para el embarque, pero sí lanza si falla).
      if (contenedores && contenedores.length > 0) {
        await crearMuchos(result.id, contenedores);
      }
      return fromDb<EmbarqueRow>({ id: result.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
      invalidateProfitDependencies(queryClient);
      notifySuccess(undefined, { title: "Embarque creado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear embarque: ${error.message}`, error, method: "CREATE_EMBARQUE" });
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
  /** Idempotency key (A.3). Si se omite, se genera uno automáticamente. */
  requestId?: string;
}

export function useDuplicarEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueOrigen, copias, requestId }: DuplicarEmbarqueInput) =>
      duplicarEmbarqueRpc(embarqueOrigen.id, copias, requestId ?? newRequestId()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
      invalidateProfitDependencies(queryClient);
      notifySuccess(undefined, { title: "Embarque duplicado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al duplicar embarque: ${error.message}`, error, method: "DUPLICATE_EMBARQUE" });
    },
  });
}
