// Barrel re-export — single entry point for all embarque types, queries & mutations.
// Los aliases de fila viven en `@/types/embarque`. Aquí se re-exportan por
// compatibilidad con los consumidores existentes (componentes y hooks).
export type {
  EmbarqueRow,
  ConceptoVentaRow,
  ConceptoCostoRow,
  DocumentoEmbarqueRow,
  NotaEmbarqueRow,
} from "@/types/embarque";

export { calcularEstadoEmbarque } from '@/lib/domain/embarque';

export {
  useEmbarques,
  useEmbarquesPaginados,
  useEmbarque,
  usePrefetchEmbarque,
  useEmbarqueConceptosVenta,
  useEmbarqueConceptosCosto,
  useEmbarqueDocumentos,
  useEmbarqueNotas,
  useEmbarqueFacturas,
  useProveedoresForSelect,
  useExpedientesCliente,
} from './useEmbarqueQueries';

export type { ExpedienteCliente } from './useEmbarqueQueries';

export {
  useCreateEmbarque,
  useUpdateEmbarque,
  useDuplicarEmbarque,
  useAvanzarEstadoEmbarque,
  useSyncEstadoEmbarque,
  useUploadDocumentoEmbarque,
  useDeleteDocumentoEmbarque,
  useCreateNotaEmbarque,
  useEliminarEmbarque,
} from './mutations';
