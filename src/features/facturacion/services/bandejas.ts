/**
 * Servicio de "bandejas de trabajo" del cockpit de Facturación (Fase 2).
 *
 * Cada bandeja expone un fetch específico y liviano. El conteo se saca
 * con `count: 'exact', head: true` para no traer payload.
 *
 * Todas las queries respetan el aislamiento multi-tenant filtrando por
 * `organization_id` explícito (además de las RLS que ya validan tenancy).
 *
 * Las queries de detalle y los conteos viven en archivos hermanos
 * (`bandejasQueries.ts` y `bandejasConteos.ts`), re-exportados aquí para
 * no romper a quienes ya importan desde este módulo.
 */
export {
  fetchFacturasPorTimbrar,
  fetchFacturasPorEnviar,
  fetchPagosRepPendientes,
  fetchIdsConEnvioExitoso,
  type FilaPorTimbrar,
  type FilaPorEnviar,
  type FilaRepPendiente,
} from "./bandejasQueries";

export {
  fetchBandejaConteos,
  type BandejaConteos,
} from "./bandejasConteos";
