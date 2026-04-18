// Barrel re-export — single entry point for all embarque types, queries & mutations
import type { Tables } from '@/integrations/supabase/types';

export type EmbarqueRow = Tables<'embarques'>;
export type ConceptoVentaRow = Tables<'conceptos_venta'>;
export type ConceptoCostoRow = Tables<'conceptos_costo'>;
export type DocumentoEmbarqueRow = Tables<'documentos_embarque'>;
export type NotaEmbarqueRow = Tables<'notas_embarque'>;

export { calcularEstadoEmbarque } from '@/lib/domain/embarque';

export {
  useEmbarques,
  useEmbarquesPaginados,
  useEmbarque,
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
} from './useEmbarqueMutations';
