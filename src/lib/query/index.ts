/**
 * Query Key Factory centralizado para React Query.
 * Importar desde aquí en lugar de usar strings hardcodeados.
 *
 * Refactor 12.95.23 (Paso 2 completo): cada dominio reside ahora en
 * `src/features/<dominio>/queryKeys.ts`. La API pública
 * `import { queryKeys } from "@/lib/query"` permanece intacta.
 */
import { embarques } from "@/features/embarques/queryKeys";
import { proformas } from "@/features/proformas/queryKeys";
import { cotizaciones } from "@/features/cotizacion/queryKeys";
import { clientes } from "@/features/cliente/queryKeys";
import { facturas } from "@/features/facturas/queryKeys";
import { proveedores } from "@/features/proveedor/queryKeys";
import {
  configuracion, puertos, exchangeRates, navieras, tiposContenedor,
  configuracionGlobal, configuracionOrg,
} from "@/features/catalogos/queryKeys";
import { dashboard, operadores, operaciones, reportes, sidebar } from "@/features/dashboard/queryKeys";
import { usuarios, planes, admin, appLogs, papelera, idempotenciaLog } from "@/features/admin/queryKeys";
import { crm } from "@/features/crm/queryKeys";
import { portal } from "@/features/portal/queryKeys";
import { auditoria } from "@/features/auditoria/queryKeys";
import { facturacion } from "@/features/facturacion/queryKeys";
import { profit } from "@/features/profit/queryKeys";
import { cxp } from "@/features/cxp/queryKeys";
import { tesoreria } from "@/features/tesoreria/queryKeys";
import { comisiones } from "@/features/comisiones/queryKeys";
import { presupuesto } from "@/features/presupuesto/queryKeys";
import { dashboardEjecutivo } from "@/features/dashboardEjecutivo/queryKeys";
import {
  bitacora, trackingLinks, clienteFinancials,
  pdfPreviewCotizacion, trackingPublico,
} from "@/features/misc/queryKeys";

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
  dashboardEjecutivo,
  papelera,
  idempotenciaLog,
  pdfPreviewCotizacion,
  trackingPublico,
} as const;
