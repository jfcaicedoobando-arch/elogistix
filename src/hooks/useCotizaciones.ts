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
} from './useCotizacionTypes';

// Queries
export {
  useCotizaciones,
  useCotizacion,
  useCotizacionesAceptadas,
  useEmbarquesVinculados,
} from './useCotizacionQueries';

// Mutations
export {
  useCreateCotizacion,
  useUpdateCotizacion,
  useDeleteCotizacion,
  useUpdateEstadoCotizacion,
} from './useCotizacionMutations';

// Conversions
export {
  useConvertirProspectoACliente,
  useConvertirCotizacionAEmbarques,
} from './useCotizacionConversions';
