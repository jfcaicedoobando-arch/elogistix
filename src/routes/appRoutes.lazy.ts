/**
 * Imports lazy de las páginas montadas en `appRoutes.tsx`. Extraídos para
 * mantener el archivo de rutas ≤200 líneas (Power of 10).
 */
import { lazy } from "react";

export const Dashboard = lazy(() => import("@/features/dashboard/routes/Dashboard"));
export const Operaciones = lazy(() => import("@/features/operaciones/routes/Operaciones"));
export const Reportes = lazy(() => import("@/features/reportes/routes/Reportes"));
export const ReportesCartera = lazy(() => import("@/features/reportes/cartera/routes/ReportesCartera"));
export const CierreMensual = lazy(() => import("@/features/reportes/routes/CierreMensual"));
export const Bitacora = lazy(() => import("@/features/dashboard/routes/Bitacora"));
export const Ayuda = lazy(() => import("@/features/dashboard/routes/Ayuda"));

export const Papelera = lazy(() => import("@/features/admin/routes/Papelera"));
export const Idempotencia = lazy(() => import("@/features/admin/routes/Idempotencia"));
export const Auditoria = lazy(() => import("@/features/auditoria/routes/AuditoriaPage"));
export const SentryDiagnostico = lazy(() => import("@/features/admin/routes/SentryDiagnostico"));

export const Embarques = lazy(() => import("@/features/embarques/routes/Embarques"));
export const EmbarqueDetalle = lazy(() => import("@/features/embarques/routes/EmbarqueDetalle"));
export const NuevoEmbarque = lazy(() => import("@/features/embarques/routes/NuevoEmbarque"));
export const EditarEmbarque = lazy(() => import("@/features/embarques/routes/EditarEmbarque"));

export const Cotizaciones = lazy(() => import("@/features/cotizacion/routes/Cotizaciones"));
export const NuevaCotizacion = lazy(() => import("@/features/cotizacion/routes/NuevaCotizacion"));
export const NuevaCotizacionInformativa = lazy(() => import("@/features/cotizacion/routes/NuevaCotizacionInformativa"));
export const CotizacionDetalle = lazy(() => import("@/features/cotizacion/routes/CotizacionDetalle"));
export const EditarCotizacion = lazy(() => import("@/features/cotizacion/routes/EditarCotizacion"));
export const CotizacionPlantillas = lazy(() => import("@/features/cotizacion/routes/CotizacionPlantillas"));
export const PdfPreviewCotizacion = lazy(() => import("@/features/dev/routes/PdfPreviewCotizacion"));

export const Clientes = lazy(() => import("@/features/cliente/routes/Clientes"));
export const ClienteDetalle = lazy(() => import("@/features/cliente/routes/ClienteDetalle"));
export const Proveedores = lazy(() => import("@/features/proveedor/routes/Proveedores"));
export const ProveedorDetalle = lazy(() => import("@/features/proveedor/routes/ProveedorDetalle"));
export const Facturacion = lazy(() => import("@/features/facturacion/routes/Facturacion"));
export const FacturaDetalle = lazy(() => import("@/features/facturacion/routes/FacturaDetalle"));
export const EstadoCuentaInterno = lazy(() => import("@/features/facturacion/estadoCuenta/routes/EstadoCuentaInterno"));
export const ProformaDetalle = lazy(() => import("@/features/proformas/routes/ProformaDetalle"));
export const ProformasListado = lazy(() => import("@/features/proformas/routes/ProformasListado"));
export const ProfitProyeccion = lazy(() => import("@/features/profit/routes/ProfitProyeccion"));
export const ProfitEstadoResultados = lazy(() => import("@/features/profit/routes/ProfitEstadoResultados"));
export const ProfitPresupuesto = lazy(() => import("@/features/profit/routes/ProfitPresupuesto"));
export const ProfitDashboardEjecutivo = lazy(() => import("@/features/profit/routes/ProfitDashboardEjecutivo"));
export const AnticiposProveedor = lazy(() => import("@/features/anticipos-proveedor/routes/AnticiposProveedor"));
export const Cxp = lazy(() => import("@/features/cxp/routes/Cxp"));
export const FacturaProveedorDetalle = lazy(() => import("@/features/cxp/routes/FacturaProveedorDetalle"));
export const Compras = lazy(() => import("@/features/cxp/routes/Compras"));
export const CxpAging = lazy(() => import("@/features/cxp/routes/CxpAging"));
export const CxpPorCapturar = lazy(() => import("@/features/bandejas/routes/CxpPorCapturar"));
export const CxpPorPagar = lazy(() => import("@/features/bandejas/routes/CxpPorPagar"));
export const CxpBuzonEntrantes = lazy(() => import("@/features/bandejas/routes/CxpBuzonEntrantes"));
export const ComprasPagos = lazy(() => import("@/features/compras/routes/ComprasPagos"));
export const ComprasNotasCredito = lazy(() => import("@/features/compras/routes/ComprasNotasCredito"));
export const ComprasReportes = lazy(() => import("@/features/compras/routes/ComprasReportes"));
export const ComprasConciliacion = lazy(() => import("@/features/compras/routes/ComprasConciliacion"));
export const ComprasPorAprobar = lazy(() => import("@/features/compras/routes/ComprasPorAprobar"));

export const Cartera = lazy(() => import("@/features/bandejas/routes/Cartera"));
export const CxcAging = lazy(() => import("@/features/cxc/routes/CxcAging"));
export const Tesoreria = lazy(() => import("@/features/tesoreria/routes/Tesoreria"));
export const TesoreriaCuentas = lazy(() => import("@/features/tesoreria/routes/TesoreriaCuentas"));
export const TesoreriaConciliacion = lazy(() => import("@/features/tesoreria/routes/TesoreriaConciliacion"));
export const TesoreriaEstadoCuenta = lazy(() => import("@/features/tesoreria/routes/TesoreriaEstadoCuenta"));
export const TesoreriaPagos = lazy(() => import("@/features/tesoreria/routes/TesoreriaPagos"));

export const TesoreriaFlujo = lazy(() => import("@/features/tesoreria/routes/TesoreriaFlujo"));
export const TesoreriaPagosProgramados = lazy(() => import("@/features/tesoreria/routes/TesoreriaPagosProgramados"));
export const Comisiones = lazy(() => import("@/features/comisiones/routes/Comisiones"));

export const CosteoTarifas = lazy(() => import("@/features/costeo/routes/CosteoTarifas"));
export const CosteoBuscar = lazy(() => import("@/features/costeo/routes/CosteoBuscar"));
export const CosteoRutas = lazy(() => import("@/features/costeo/routes/CosteoRutas"));
export const CosteoAgentes = lazy(() => import("@/features/costeo/routes/CosteoAgentes"));
export const CosteoNavieras = lazy(() => import("@/features/costeo/routes/CosteoNavieras"));
export const CosteoDemorasVenta = lazy(() => import("@/features/costeo/routes/CosteoDemorasVenta"));

export const Usuarios = lazy(() => import("@/features/admin/routes/admin-org/Usuarios"));
export const Configuracion = lazy(() => import("@/features/admin/routes/admin-org/Configuracion"));

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

export const DireccionDashboard = lazy(() => import("@/features/dashboard/direccion/DireccionDashboard"));
