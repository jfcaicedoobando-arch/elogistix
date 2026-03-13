// Barrel re-export — maintains backward compatibility for all existing imports
export {
  calcularEstadoEmbarque,
  type EmbarqueRow,
  type ConceptoVentaRow,
  type ConceptoCostoRow,
  type DocumentoEmbarqueRow,
  type NotaEmbarqueRow,
} from './useEmbarqueUtils';

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
} from './useEmbarqueQueries';

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
