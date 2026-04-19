/**
 * Barrel re-export para cotizaciones.
 * Importar desde aquí en lugar de los módulos individuales.
 */

// Types
export type {
  ConceptoVentaCotizacion,
  DimensionLCL,
  DimensionAerea,
  CotizacionRow,
  CreateCotizacionInput,
} from './cotizacion/useCotizacionTypes';

// Queries
export {
  useCotizaciones,
  useCotizacion,
  usePrefetchCotizacion,
  useCotizacionesAceptadas,
  useEmbarquesVinculados,
} from './cotizacion/useCotizacionQueries';

// Mutations
export {
  useCreateCotizacion,
  useUpdateCotizacion,
  useDeleteCotizacion,
  useUpdateEstadoCotizacion,
} from './cotizacion/useCotizacionMutations';

// Conversions
export {
  useConvertirProspectoACliente,
  useConvertirCotizacionAEmbarques,
} from './cotizacion/useCotizacionConversions';
