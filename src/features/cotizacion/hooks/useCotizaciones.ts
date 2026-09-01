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
} from '@/features/cotizacion/types';

// Queries
export {
  useCotizacion,
  usePrefetchCotizacion,
  useCotizacionesAceptadas,
  useEmbarquesVinculados,
} from './useCotizacionQueries';

// Mutations
export {
  useCreateCotizacion,
  useUpdateCotizacion,
  useDeleteCotizacion,
  useUpdateEstadoCotizacion,
  useReactivarCotizacion,
} from './mutations/useCotizacionMutations';

// Conversions
export {
  useConvertirProspectoACliente,
  useCrearEmbarqueBorrador,
} from './useCotizacionConversions';

