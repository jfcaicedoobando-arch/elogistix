// Barrel re-export — single entry point for all embarque types, queries & mutations.
// Los aliases de fila viven en `@/features/embarques/types/embarque`. Aquí se re-exportan por
// compatibilidad con los consumidores existentes (componentes y hooks).
export type {
  EmbarqueRow,
  
  ConceptoCostoRow,
  DocumentoEmbarqueRow,
  NotaEmbarqueRow,
} from "@/features/embarques/types/embarque";

export { calcularEstadoEmbarque } from '@/features/embarques/domain/embarque';

export {
  useEmbarquesPaginados,
  useEmbarque,
  usePrefetchEmbarque,
  useEmbarqueConceptosVenta,
  useEmbarqueConceptosCosto,
  useProveedoresForSelect,
  useExpedientesCliente,
} from './useEmbarqueQueries';

export type { ExpedienteCliente } from './useEmbarqueQueries';

export {
  useCreateEmbarque,
  useUpdateEmbarque,
  useDuplicarEmbarque,
  useAvanzarEstadoEmbarque,
  useReabrirEmbarque,
  useSyncEstadoEmbarque,
  useUploadDocumentoEmbarque,
  useDeleteDocumentoEmbarque,
  useCreateDocumentoEmbarque,
  useSetDocumentoNoAplica,
  useCreateNotaEmbarque,
  useEliminarEmbarque,
} from './mutations';
