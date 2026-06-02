/**
 * Query Key Factory centralizado para React Query.
 * Importar desde aquí en lugar de usar strings hardcodeados.
 *
 * Refactor 11.60.0 (Bloque B4): partido por dominio en `keys/*.ts` para
 * cumplir Power of 10 (archivos ≤200 líneas). API pública intacta —
 * `import { queryKeys } from "@/lib/query"` sigue funcionando idéntico.
 */
import { embarques } from "./keys/embarques";
import { proformas } from "./keys/proformas";
import { cotizaciones } from "./keys/cotizaciones";
import { clientes } from "./keys/clientes";
import { facturas } from "./keys/facturas";
import { proveedores } from "./keys/proveedores";
import {
  configuracion, puertos, exchangeRates, navieras, tiposContenedor,
  configuracionGlobal, configuracionOrg,
} from "./keys/catalogos";
import { dashboard, operadores, operaciones, reportes, sidebar } from "./keys/dashboard";
import { usuarios, planes, admin, appLogs, papelera, idempotenciaLog } from "./keys/admin";
import { crm } from "./keys/crm";
import { portal } from "./keys/portal";
import { auditoria } from "./keys/auditoria";
import { facturacion } from "./keys/facturacion";
import { profit } from "./keys/profit";
import { cxp } from "./keys/cxp";
import { tesoreria } from "./keys/tesoreria";
import { comisiones } from "./keys/comisiones";
import { presupuesto } from "./keys/presupuesto";
import {
  bitacora, trackingLinks, clienteFinancials,
  pdfPreviewCotizacion, trackingPublico,
} from "./keys/misc";

export const queryKeys = {
  embarques,
  proformas,
  cotizaciones,
  clientes,
  facturas,
  proveedores,
  configuracion,
  trackingLinks,
  clienteFinancials,
  puertos,
  exchangeRates,
  bitacora,
  dashboard,
  operadores,
  operaciones,
  reportes,
  configuracionGlobal,
  planes,
  configuracionOrg,
  navieras,
  tiposContenedor,
  portal,
  sidebar,
  usuarios,
  admin,
  crm,
  auditoria,
  appLogs,
  facturacion,
  profit,
  cxp,
  tesoreria,
  comisiones,
  presupuesto,
  papelera,
  idempotenciaLog,
  pdfPreviewCotizacion,
  trackingPublico,
} as const;
