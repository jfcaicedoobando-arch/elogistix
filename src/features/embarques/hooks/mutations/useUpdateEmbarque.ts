/**
 * Mutation: actualización de datos generales del embarque + sincronización de contenedores.
 * Otras mutaciones del dominio viven en archivos hermanos:
 *   - `./useEstadoEmbarque` (avanzar / sync / reabrir)
 *   - `./useDocumentoEmbarqueMutations` (upload / delete / create / setNoAplica)
 *   - `./useNotaEmbarque` (createNota)
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/query';
import { actualizarEmbarqueRpc } from '@/features/embarques/services';
import type { ContenedorBorrador } from '@/features/embarques/types/contenedor';
import { newRequestId } from '@/lib/idempotency';
import { invalidateProfitDependencies } from '@/features/profit/hooks/invalidateProfitDependencies';

type EmbarqueRow = Tables<'embarques'>;

interface UpdateEmbarqueInput {
  id: string;
  embarque: Partial<TablesInsert<'embarques'>>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
  /** Lista de contenedores hijos (Fase 2 v12.11.0). Si se omite, no se sincronizan. */
  contenedores?: ContenedorBorrador[];
  /** Idempotency key (A.3). */
  requestId?: string;
  /** FIX-15 · Bloqueo optimista: `updated_at` leído al abrir el wizard. */
  expectedUpdatedAt?: string | null;
}

export function useUpdateEmbarque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateEmbarqueInput) => {
      await actualizarEmbarqueRpc({ ...input, requestId: input.requestId ?? newRequestId() });
      return { id: input.id } as EmbarqueRow;
    },
    onSuccess: (embarqueActualizado) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVenta(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.conceptosCosto(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.contenedores(embarqueActualizado.id) });
      // B-1 (mismo mismatch del toggle de comisión): el P&L del embarque cambia
      // al editar conceptos/datos y su query vive en el árbol singular
      // v13.823.145 — El resumen del embarque (y varias sub-queries de cierre,
      // TC y seguros) viven en el árbol singular ['embarque', id, ...], que el
      // prefijo plural ['embarques'] NO cubre: sin esto el resumen quedaba con
      // los datos anteriores hasta recargar o volver a guardar.
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.single(embarqueActualizado.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.pnlFinanciero(embarqueActualizado.id) });

      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
      invalidateProfitDependencies(queryClient);
      // Nota: el toast de éxito lo dispara el caller (p. ej. useEditarEmbarqueWizard)
      // con una descripción más específica; evitamos duplicar aquí.
    },
  });
}
