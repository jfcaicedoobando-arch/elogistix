/**
 * Query Key Factory centralizado para React Query.
 * Importar desde aquí en lugar de usar strings hardcodeados.
 *
 * Refactor 12.95.23 (Paso 2 completo): cada dominio reside ahora en
 * `src/features/<dominio>/queryKeys.ts`. La API pública
 * `import { queryKeys } from "@/lib/query"` permanece intacta.
 */
import { embarques, trackingLinks, trackingPublico } from "@/features/embarques/queryKeys";
import { proformas } from "@/features/proformas/queryKeys";
import { cotizaciones, pdfPreviewCotizacion, productosCatalogo } from "@/features/cotizacion/queryKeys";
import { clientes, clienteFinancials } from "@/features/cliente/queryKeys";

import { proveedores } from "@/features/proveedor/queryKeys";
import {
  configuracion, puertos, exchangeRates, navieras, tiposContenedor,
  configuracionGlobal, configuracionOrg,
} from "@/features/catalogos/queryKeys";
import {
  bitacora, dashboard, operadores, operaciones, reportes, sidebar,
  direccion, dashboardOperador, embarquesPendientesAdmin,
} from "@/features/dashboard/queryKeys";
import {
  usuarios, usuariosPortalCliente, usuariosPortalAgente,
  planes, admin, appLogs, papelera, idempotenciaLog,
  alertasSistema, demoLeads,
} from "@/features/admin/queryKeys";
import { crm } from "@/features/crm/queryKeys";
import { portal } from "@/features/portal/queryKeys";
import { auditoria } from "@/features/auditoria/queryKeys";
import { facturacion, facturas } from "@/features/facturacion/queryKeys";
import { profit } from "@/features/profit/queryKeys";
import { cxc } from "@/features/cxc/queryKeys";
import {
  cxp, proveedorFacturas, proveedorNotasCredito, pagosProveedor,
  proveedorSalud, conceptosCosto,
} from "@/features/cxp/queryKeys";
import { bandejas } from "@/features/bandejas/queryKeys";
import { tesoreria } from "@/features/tesoreria/queryKeys";
import { comisiones } from "@/features/comisiones/queryKeys";
import { presupuesto } from "@/features/presupuesto/queryKeys";
import { dashboardEjecutivo } from "@/features/dashboardEjecutivo/queryKeys";
import { costeo } from "@/features/costeo/queryKeys";
import { portalAgente } from "@/features/portal-agente/queryKeys";
import { notificaciones } from "@/features/notificaciones/queryKeys";
import { marketing } from "@/features/marketing/queryKeys";

export const queryKeys = {
  costeo,
  portalAgente,
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
  usuariosPortalCliente,
  usuariosPortalAgente,
  admin,
  crm,
  auditoria,
  appLogs,
  facturacion,
  profit,
  cxc,
  cxp,
  proveedorFacturas,
  proveedorNotasCredito,
  pagosProveedor,
  proveedorSalud,
  conceptosCosto,
  bandejas,
  tesoreria,
  comisiones,
  presupuesto,
  dashboardEjecutivo,
  papelera,
  idempotenciaLog,
  pdfPreviewCotizacion,
  productosCatalogo,
  trackingPublico,
  direccion,
  dashboardOperador,
  embarquesPendientesAdmin,
  alertasSistema,
  demoLeads,
  notificaciones,
  marketing,
} as const;
