/**
 * Imports lazy de las páginas montadas en `appRoutes.tsx`. Extraídos para
 * mantener el archivo de rutas ≤200 líneas (Power of 10).
 */
import { lazy } from "react";

export const Dashboard = lazy(() => import("@/pages/dashboard/Dashboard"));
export const Operaciones = lazy(() => import("@/pages/dashboard/Operaciones"));
export const Reportes = lazy(() => import("@/pages/dashboard/Reportes"));
export const Bitacora = lazy(() => import("@/pages/dashboard/Bitacora"));
export const Ayuda = lazy(() => import("@/pages/dashboard/Ayuda"));

export const Papelera = lazy(() => import("@/pages/admin/Papelera"));
export const Idempotencia = lazy(() => import("@/pages/admin/Idempotencia"));
export const Auditoria = lazy(() => import("@/features/auditoria/routes/AuditoriaPage"));
export const SentryDiagnostico = lazy(() => import("@/pages/admin/SentryDiagnostico"));

export const Embarques = lazy(() => import("@/features/embarques/routes/Embarques"));
export const EmbarqueDetalle = lazy(() => import("@/features/embarques/routes/EmbarqueDetalle"));
export const NuevoEmbarque = lazy(() => import("@/features/embarques/routes/NuevoEmbarque"));
export const EditarEmbarque = lazy(() => import("@/features/embarques/routes/EditarEmbarque"));

export const Cotizaciones = lazy(() => import("@/features/cotizacion/routes/Cotizaciones"));
export const NuevaCotizacion = lazy(() => import("@/features/cotizacion/routes/NuevaCotizacion"));
export const NuevaCotizacionInformativa = lazy(() => import("@/features/cotizacion/routes/NuevaCotizacionInformativa"));
export const CotizacionDetalle = lazy(() => import("@/features/cotizacion/routes/CotizacionDetalle"));
export const EditarCotizacion = lazy(() => import("@/features/cotizacion/routes/EditarCotizacion"));
export const PdfPreviewCotizacion = lazy(() => import("@/pages/dev/PdfPreviewCotizacion"));

export const Clientes = lazy(() => import("@/features/cliente/routes/Clientes"));
export const ClienteDetalle = lazy(() => import("@/features/cliente/routes/ClienteDetalle"));
export const Proveedores = lazy(() => import("@/pages/proveedores/Proveedores"));
export const ProveedorDetalle = lazy(() => import("@/pages/proveedores/ProveedorDetalle"));
export const Facturacion = lazy(() => import("@/features/facturacion/routes/Facturacion"));
export const FacturaDetalle = lazy(() => import("@/pages/facturacion/FacturaDetalle"));
export const ProformaDetalle = lazy(() => import("@/features/proformas/routes/ProformaDetalle"));
export const ProfitProyeccion = lazy(() => import("@/pages/profit/ProfitProyeccion"));
export const ProfitEstadoResultados = lazy(() => import("@/pages/profit/ProfitEstadoResultados"));
export const ProfitPresupuesto = lazy(() => import("@/pages/profit/ProfitPresupuesto"));
export const ProfitDashboardEjecutivo = lazy(() => import("@/pages/profit/ProfitDashboardEjecutivo"));
export const Cxp = lazy(() => import("@/pages/cxp/Cxp"));
export const CxpPorCapturar = lazy(() => import("@/pages/bandejas/CxpPorCapturar"));
export const CxpPorPagar = lazy(() => import("@/pages/bandejas/CxpPorPagar"));
export const FacturacionPorEmitir = lazy(() => import("@/pages/bandejas/FacturacionPorEmitir"));
export const Cartera = lazy(() => import("@/pages/bandejas/Cartera"));
export const Tesoreria = lazy(() => import("@/pages/tesoreria/Tesoreria"));
export const TesoreriaCuentas = lazy(() => import("@/pages/tesoreria/TesoreriaCuentas"));
export const TesoreriaConciliacion = lazy(() => import("@/pages/tesoreria/TesoreriaConciliacion"));
export const TesoreriaFlujo = lazy(() => import("@/pages/tesoreria/TesoreriaFlujo"));
export const Comisiones = lazy(() => import("@/pages/comisiones/Comisiones"));

export const CosteoTarifas = lazy(() => import("@/features/costeo/routes/CosteoTarifas"));
export const CosteoBuscar = lazy(() => import("@/features/costeo/routes/CosteoBuscar"));
export const CosteoRutas = lazy(() => import("@/features/costeo/routes/CosteoRutas"));
export const CosteoAgentes = lazy(() => import("@/features/costeo/routes/CosteoAgentes"));
export const CosteoNavieras = lazy(() => import("@/features/costeo/routes/CosteoNavieras"));
export const CosteoDemorasVenta = lazy(() => import("@/features/costeo/routes/CosteoDemorasVenta"));

export const Usuarios = lazy(() => import("@/pages/admin-org/Usuarios"));
export const Configuracion = lazy(() => import("@/pages/admin-org/Configuracion"));

// CRM — anidado bajo /crm con CrmLayout
export const CrmLayout = lazy(() => import("@/features/crm/routes/CrmLayout"));
export const CrmDashboard = lazy(() => import("@/features/crm/routes/CrmDashboard"));
export const CrmMiDia = lazy(() => import("@/features/crm/routes/MiDia"));
export const Leads = lazy(() => import("@/features/crm/routes/Leads"));
export const LeadDetalle = lazy(() => import("@/features/crm/routes/LeadDetalle"));
export const Oportunidades = lazy(() => import("@/features/crm/routes/Oportunidades"));
export const OportunidadDetalle = lazy(() => import("@/features/crm/routes/OportunidadDetalle"));
export const ActividadesCrm = lazy(() => import("@/features/crm/routes/Actividades"));
export const AnaliticaCrm = lazy(() => import("@/features/crm/routes/Analitica"));
export const CrmConfiguracion = lazy(() => import("@/features/crm/routes/Configuracion"));
