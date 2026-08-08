/**
 * Rutas centralizadas de la aplicación (Lote 7b · DRY).
 *
 * Fuente única de verdad para URLs consumidas desde componentes (Link `to=`,
 * `navigate(...)`, `href=`). Elimina la duplicación de literales `/embarques`,
 * `/portal/...`, `/compras/...`, etc. repartidos en decenas de archivos.
 *
 * REGLAS:
 *   - `ROUTES.*` son rutas estáticas (string const).
 *   - Los `path=` en `src/routes/appRoutes.tsx` (definición del router) siguen
 *     siendo literales — este archivo es para consumidores, no definiciones.
 *   - Al añadir una ruta nueva: registrarla aquí primero y consumir desde aquí.
 */

export const ROUTES = {
  // Landing / auth públicas
  LANDING: "/",
  LOGIN: "/login",
  LOGIN_SIGNUP: "/login?tab=signup",
  ONBOARDING: "/onboarding",

  // App
  INICIO: "/inicio",
  DASHBOARD: "/dashboard",
  OPERACIONES: "/operaciones",
  AYUDA: "/ayuda",
  SENTRY: "/sentry",
  BITACORA: "/bitacora",
  PAPELERA: "/papelera",
  IDEMPOTENCIA: "/idempotencia",
  AUDITORIA: "/auditoria",
  USUARIOS: "/usuarios",
  CONFIGURACION: "/configuracion",

  // Embarques
  EMBARQUES: "/embarques",
  EMBARQUE_NUEVO: "/embarques/nuevo",

  // Cotizaciones
  COTIZACIONES: "/cotizaciones",
  COTIZACION_NUEVA: "/cotizaciones/nueva",
  COTIZACION_NUEVA_TARIFARIO: "/cotizaciones/nueva/tarifario",

  // Facturación / proformas / cobranza
  FACTURACION: "/facturacion",
  PROFORMAS: "/proformas",
  CARTERA: "/cartera",

  // Clientes
  CLIENTES: "/clientes",

  // Compras
  COMPRAS: "/compras",
  COMPRAS_POR_CAPTURAR: "/compras/por-capturar",
  COMPRAS_POR_APROBAR: "/compras/por-aprobar",
  COMPRAS_POR_PAGAR: "/compras/por-pagar",
  COMPRAS_FACTURAS: "/compras/facturas",
  COMPRAS_PAGOS: "/compras/pagos",
  COMPRAS_NOTAS_CREDITO: "/compras/notas-credito",
  COMPRAS_PROVEEDORES: "/compras/proveedores",
  COMPRAS_AGING: "/compras/aging",
  COMPRAS_REPORTES: "/compras/reportes",
  COMPRAS_CONCILIACION: "/compras/conciliacion",

  // Tesorería
  TESORERIA: "/tesoreria",
  TESORERIA_CUENTAS: "/tesoreria/cuentas",
  TESORERIA_CONCILIACION: "/tesoreria/conciliacion",
  TESORERIA_ESTADO_CUENTA: "/tesoreria/estado-cuenta",
  TESORERIA_PAGOS: "/tesoreria/pagos",

  TESORERIA_FLUJO: "/tesoreria/flujo",

  // Comisiones / costeo
  COMISIONES: "/comisiones",
  COSTEO: "/costeo",
  COSTEO_TARIFAS: "/costeo/tarifas",
  COSTEO_BUSCAR: "/costeo/buscar",
  COSTEO_RUTAS: "/costeo/rutas",
  COSTEO_AGENTES: "/costeo/agentes",
  COSTEO_NAVIERAS: "/costeo/navieras",
  COSTEO_DEMORAS_VENTA: "/costeo/demoras-venta",

  // Profit
  PROFIT: "/profit",
  PROFIT_DASHBOARD: "/profit/dashboard",
  PROFIT_PROYECCION: "/profit/proyeccion",
  PROFIT_ESTADO_RESULTADOS: "/profit/estado-resultados",
  PROFIT_PRESUPUESTO: "/profit/presupuesto",

  // Reportes
  REPORTES: "/reportes",
  REPORTES_RENTABILIDAD: "/reportes/rentabilidad",
  REPORTES_CIERRE_MENSUAL: "/reportes/cierre-mensual",

  // CRM
  CRM: "/crm",
  CRM_LEADS: "/crm/leads",
  CRM_OPORTUNIDADES: "/crm/oportunidades",
  CRM_ACTIVIDADES: "/crm/actividades",
  CRM_CONFIGURACION: "/crm/configuracion",

  // Portal cliente
  PORTAL: "/portal",
  PORTAL_LOGIN: "/portal/login",
  PORTAL_EMBARQUES: "/portal/embarques",
  PORTAL_COTIZACIONES: "/portal/cotizaciones",
  PORTAL_FACTURAS: "/portal/facturas",
  PORTAL_ESTADO_CUENTA: "/portal/estado-de-cuenta",
  PORTAL_PERFIL: "/portal/perfil",

  // Portal agente
  AGENTE: "/agente",
  AGENTE_EMBARQUES: "/agente/embarques",
  AGENTE_TARIFAS: "/agente/tarifas",
  AGENTE_GARANTIAS: "/agente/garantias",
  AGENTE_PERFIL: "/agente/perfil",

  // Admin
  ADMIN: "/admin",
  ADMIN_ORGANIZACIONES: "/admin/organizaciones",

  // Legal
  LEGAL_PRIVACIDAD: "/legal/privacidad",
  LEGAL_TERMINOS: "/legal/terminos",
  LEGAL_SEGURIDAD: "/legal/seguridad",

  // Recursos SEO
  RECURSOS_GUIA_CARTA_PORTE: "/recursos/guia-carta-porte-3",
  RECURSOS_GUIA_INCOTERMS: "/recursos/guia-incoterms-2020",
  RECURSOS_GUIA_PUERTOS: "/recursos/guia-puertos-mexico",
} as const;
