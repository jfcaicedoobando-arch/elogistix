export type ChangeType = "major" | "minor" | "patch";

export interface ChangelogEntry {
  version: string;
  date: string;
  type: ChangeType;
  title: string;
  description: string;
}

/**
 * Solo las entradas más recientes viven eager para minimizar el bundle del
 * lazy-chunk de Changelog. Las versiones 8.x completas y el histórico v1-v7
 * se cargan bajo demanda.
 */
export const recentChangelog: ChangelogEntry[] = [
  {
    version: "8.96.0",
    date: "2026-04-26",
    type: "minor",
    title: "Catálogo central de mensajes de error con claves por campo y paso",
    description: "Nuevo catálogo central src/lib/domain/errorCatalog.ts como única fuente de verdad para los textos de validación del wizard de embarques. Cada mensaje se identifica con una clave estable '<step>.<campo>.<regla>' (ej. '2.eta.afterEtd', '3.documento.tooLarge'), las etiquetas de campo están centralizadas en FIELD_LABELS, y los mensajes con valores dinámicos (ids, tamaños, nombres de archivo) usan funciones que reciben parámetros tipados. API del catálogo: msg(key) para Zod refinements y getMessage(key, params) para mensajes con interpolación. Se extrajo formatValidationMessage a un módulo neutro src/lib/domain/validationFormat.ts para evitar ciclos de import. El schema embarqueWizardSchemas.ts ya no contiene strings inline: todas las llamadas a fmt() fueron reemplazadas por msg()/getMessage(). Imposible ahora introducir variaciones del mismo error en distintos archivos: cualquier cambio de tono o traducción se hace en un solo lugar. Test src/lib/domain/__tests__/errorCatalog.test.ts cubre claves estáticas, dinámicas, formato 'Campo: razón.' para todas las claves del catálogo y resiliencia ante claves desconocidas. Tests 206/206 pasando.",
  },
  {
    version: "8.94.0",
    date: "2026-04-26",
    type: "patch",
    title: "Wizard Nuevo Embarque: mensajes de validación estandarizados",
    description: "Unificación de tono, formato y severidad de todos los mensajes de error del wizard de embarques bajo el patrón 'Campo: razón.' (español MX, tuteo, sin signos de admiración). Nuevo helper formatValidationMessage(field, reason) y constante STEP_LABELS en src/lib/domain/embarqueWizardSchemas.ts garantizan consistencia futura. Toasts de validación pasan a 'Revisa el Paso N: <nombre>' (Datos generales / Ruta / Documentos / Costos). Toasts de error de submit pasan al patrón 'Error: <fase>' (generación de expediente / subida de documentos / guardado del embarque). El toast de archivo rechazado en StepDocumentos se reformatea con título 'Documento rechazado' y descripción en el mismo formato. Sin cambios funcionales: la lógica de validación se mantiene idéntica.",
  },
  {
    version: "8.93.0",
    date: "2026-04-26",
    type: "minor",
    title: "Wizard Nuevo Embarque: validaciones consistentes y manejo de errores granular",
    description: "Validación end-to-end con zod para los 4 pasos del wizard de Nuevo Embarque (antes solo el paso 1 validaba). Nuevo módulo src/lib/domain/embarqueWizardSchemas.ts con schemas por paso: (1) Datos Generales (modo, tipo, cliente, descripción), (2) Ruta condicional por modo de transporte —Marítimo (puertos, naviera, tipo servicio, contenedor, tipo contenedor), Aéreo (aeropuertos, MAWB) y Terrestre (ciudades, transportista)— con validación cruzada ETA ≥ ETD, (3) Documentos (tamaño máx 10MB, MIME PDF/JPG/PNG/XLSX/DOCX), (4) Costos y Pricing (al menos 1 concepto venta y 1 de costo válidos, cantidad ≥ 1, montos ≥ 0, tipos de cambio USD/EUR > 0). El controller useNuevoEmbarqueWizard ahora expone validateStep(step) unificado y valida los 4 pasos antes de enviar (handleFinish), saltando al primer paso con error y mostrando toast contextual. Cada Step component (StepDatosRuta, StepDocumentos, StepCostosPrecios) recibe sus errores y muestra mensajes inline o en Alert. Cálculo automático de ETA sugerida al ingresar ETD si la cotización vinculada tiene tiempo_transito_dias. Manejo granular de errores en useEmbarqueSubmitOrchestrator: cada fase (resolverExpediente, subirDocumentos, createEmbarque, updateEstadoCotizacion) tiene su propio try/catch con mensaje específico; la actualización del estado de la cotización ahora es no-bloqueante (warning si falla). Nuevo archivo de tests src/lib/domain/__tests__/embarqueWizardSchemas.test.ts (17 casos). Build limpio (tsc), 201/201 pruebas pasando (184 + 17 nuevas).",
  },
  {
    version: "8.92.0",
    date: "2026-04-26",
    type: "minor",
    title: "Auditoría: 3 page controllers, 4 services y 4 hooks raíz reorganizados",
    description: "Top 5 mejoras de la auditoría post-v8.91.0 ejecutadas en un solo paso, sin breaking changes. (1) Embarques.tsx (241 LOC con 5 useState/useMemo + handler de eliminar + builder de exportToCsv inline) reducido a UI pura (~150 LOC) tras extraer src/hooks/embarque/useEmbarquesPageController.ts que orquesta filtros, query de embarques, prefetch, permisos, dialogs (eliminar/duplicar), columnas y export CSV. (2) Facturacion.tsx (234 LOC) reducido a composición + columnas (~165 LOC) tras extraer src/hooks/facturacion/useFacturacionPageController.ts (filtros server-side, paginación, mutación marcarPagado, registro de bitácora, export CSV). (3) ProveedorDetalle.tsx (196 LOC con 3 useState + cálculos de totales + 2 handlers de mutación inline) reducido a UI pura (~155 LOC) tras extraer src/hooks/proveedor/useProveedorDetalleController.ts (carga proveedor, operaciones, totales facturado/pagado/pendiente, dialogs, handlers de update/delete con bitácora). (4) Cuatro services críticos migrados al patrón folder/barrel: services/bitacora/, services/catalogos/, services/configuracion/ y services/usuario/ con index.ts; los archivos antiguos quedan como shim de re-export. (5) Cuatro hooks raíz movidos a sus carpetas de dominio: useClientes → hooks/cliente/, useProveedores → hooks/proveedor/, useFacturas → hooks/facturacion/ y useDashboardData → hooks/dashboard/ (nueva carpeta); los archivos raíz quedan como shim. Build limpio (tsc), 184/184 pruebas pasando.",
  },
  {
    version: "8.91.0",
    date: "2026-04-26",
    type: "minor",
    title: "Auditoría: controllers de proveedor y Cotizaciones, 3 services a folder/barrel y promoción de ProfitBadge",
    description: "Top 5 mejoras de la auditoría arquitectónica post-v8.90.0 ejecutadas en un solo paso, sin breaking changes. (1) NuevoProveedorDialog (202 LOC, mezclaba estado wizard + validación + handlers + UI) reducido a ~120 LOC presentacionales tras extraer src/hooks/proveedor/useNuevoProveedorController.ts (~120 LOC) que centraliza estado, validación, derivados (isAgenteCarga, rfcLabel) y orquestación de pasos. (2) EditarProveedorDialog (161 LOC) reducido a UI pura tras extraer src/hooks/proveedor/useEditarProveedorController.ts que encapsula estado del form, errores derivados con touched-fields, validación de email y handler de guardado. (3) Cotizaciones.tsx (245 LOC, 7 hooks + filtros + KPIs + handlers inline) reducido a composición de columnas + JSX (~155 LOC) tras extraer src/hooks/cotizacion/useCotizacionesPageController.ts (~150 LOC) que orquesta useCotizaciones, useDeleteCotizacion, useDuplicarCotizacion, useClientesForSelect, useListPageState, KPIs derivados y handlers (duplicar, exportar CSV, eliminar, navegación). (4) Tres services críticos pasan al patrón folder/barrel: services/dashboard/, services/facturas/ y services/search/ con index.ts; los archivos antiguos services/dashboardService.ts, services/facturasService.ts y services/searchService.ts quedan como shim de re-export para preservar imports. (5) ProfitBadge promovido de src/components/shared/ a src/components/ProfitBadge.tsx; src/components/shared/ProfitBadge.tsx queda como shim de re-export (la carpeta shared/ se eliminará en una futura iteración una vez migrados los 5 importadores). Build verde, 184/184 pruebas pasando.",
  },
  {
    version: "8.90.0",
    date: "2026-04-26",
    type: "minor",
    title: "Auditoría: agrupación de hooks (catálogos/configuración/portal), 3 services a folder/barrel y controller de NuevoClienteDialog",
    description: "Top 5 mejoras de la auditoría arquitectónica ejecutadas en un solo paso, sin breaking changes. (1) src/hooks/catalogos/ agrupa useNavieras, usePuertos, useTiposContenedor, useOperadoresDistintos, useTasaIVA y useExchangeRates con barrel index.ts. (2) src/hooks/configuracion/ agrupa useConfiguracion, useConfiguracionGlobal, useConfiguracionOrg y useConfiguracionState con barrel. (3) src/hooks/portal/ agrupa usePortalData, usePortalDashboardKpis y usePortalDocumentDownload con barrel. (4) Tres services críticos pasan al patrón folder/barrel: services/auth/, services/storage/ y services/csf/ con index.ts (los archivos antiguos services/authService.ts, services/storage.ts y services/csfService.ts quedan como shim de re-export para preservar todos los imports existentes). (5) NuevoClienteDialog (228 LOC, mezclaba estado del wizard, parsing CSF, validación, mutación y UI) se redujo a ~120 LOC presentacionales tras extraer toda la lógica al hook src/hooks/cliente/useNuevoClienteController.ts (~150 LOC). Todos los hooks raíz movidos quedan como shim de re-export desde su nueva ubicación, garantizando que ningún import de la app o tests se rompa. Build verde, 184/184 pruebas pasando.",
  },
  {
    version: "8.89.0",
    date: "2026-04-26",
    type: "patch",
    title: "Limpieza de tests obsoletos: -17 pruebas tautológicas, +1 regla en ARCHITECTURE",
    description: "Auditoría completa de los 25 archivos de test (201 pruebas) detectó cobertura redundante. Eliminados: src/test/example.test.ts (smoke-test trivial expect(true).toBe(true)), src/lib/__tests__/utils.test.ts (probaba cn() que es wrapper de clsx+tailwind-merge), src/constants/__tests__/proveedorConstants.test.ts (afirmaciones tautológicas sobre arrays literales), src/data/__tests__/ports.test.ts y src/data/ports.ts (catálogo migrado a BD desde v7.x; el archivo era seed sin consumidores). 6 tests tautológicos recortados de embarqueConstants.test.ts (afirmaciones sobre longitudes y miembros de ESTADOS_EMBARQUE / CATALOGO_CONCEPTOS); se conservan los 4 tests de getDocsForMode que sí cubren lógica condicional. Carpeta src/data/ eliminada por completo (sin contenido). ARCHITECTURE.md §11 actualizada con regla explícita 'no testear constantes literales ni wrappers de terceros' y §12 documenta la desaparición de src/data/. Resultado: 25 → 21 archivos de test, 201 → 184 pruebas, 100% pasando, sin pérdida de cobertura real (los 17 tests removidos eran tautologías o probaban librerías ajenas).",
  },
  {
    version: "8.88.0",
    date: "2026-04-26",
    type: "patch",
    title: "ARCHITECTURE.md reorganizado: TOC, naming, React Query, performance, RLS, testing y glosario",
    description: "Reescritura integral del documento de arquitectura para cerrar gaps de documentación detectados en la auditoría. Cambios: (Bloque 1) Cabecera con versión y fecha de revisión, referencia espejo a mem://technical/architecture-and-standards, tabla de contenidos con 14 secciones numeradas, nueva §2 'Flujo de datos canónico' con diagrama ASCII (Page → Hook → Service → Supabase → Mapper → Component), inclusión explícita de src/content/ separado de src/data/, sección dedicada para hooks de dominio. (Bloque 2) Nuevas secciones: §7 Naming (consolida patrones es/en + convenciones para hooks, controllers, tipos, componentes, services), §8 React Query (queryKeys centralizados, staleTime por tipo de dato, política de invalidación, paginación servidor), §9 Performance/Lazy-loading (páginas lazy, jsPDF dinámico, patrón changelog, regla >50KB), §10 RLS y multi-tenant (organization_id, user_roles, security definer, edge functions), §11 Testing (Vitest, qué se testea y qué no, ubicación __tests__/, comandos), §3.5 Controllers de página formalizados. (Bloque 3) Consolidación de 'Excepciones autorizadas' + 'Convención de barrels' + 'Auditoría useEffect' bajo §12 'Decisiones explícitas (con fecha)'; renombrado de 'Deuda técnica aceptada' a §13 'Decisiones de no hacer' añadiendo entrada de costosPLTypes.ts; corrección de referencia obsoleta en §6 (services/<dominio>Services.ts → services/<dominio>/index.ts); §14 Glosario con 12 términos del proyecto (embarque, expediente, cotización, proforma, concepto, P&L, CSF, incoterm, organización, cliente, operador, portal de clientes). El archivo crece de 125 a ~250 líneas pero gana navegabilidad y cubre los gaps reales de onboarding. Sin cambios de código fuente; build verde y 201/201 pruebas pasando.",
  },
  {
    version: "8.87.0",
    date: "2026-04-26",
    type: "minor",
    title: "Refactor arquitectónico Fase 3: lazy-load PDF y consolidación de tipos",
    description: "Pasos 8-10 del plan de auditoría arquitectónica integral. (8) Lazy-load de jsPDF: el generador @/generators/proformaPdf (que arrastra ~200KB de jsPDF + jspdf-autotable) ahora se carga vía dynamic import() en useDescargarProformaPdf y useDialogGenerarProformaController, eliminándolo del bundle inicial y dejándolo sólo en el chunk de la acción de descarga. cotizacionPdf ya estaba lazy desde antes. (9) Consolidación de tipos: se eliminó el re-export legacy src/hooks/cotizacion/useCotizacionTypes.ts y se migraron los 4 consumidores restantes (useCotizacionQueries, useCotizacionMutations, useCotizacionConversions, useCotizaciones, usePortalCotizacionDetalle) a importar directamente desde @/types/cotizacion. costosPLTypes.ts se conserva por contener el helper UI calcTotalsPL usado por SeccionCostosInternosPL{Local,Detalle}. (10) Se confirmó que la regla de shadcn read-only (use-toast.ts, use-mobile.tsx, sidebar.tsx) ya estaba documentada en ARCHITECTURE.md sección 3 + checklist. Build verde y 201/201 pruebas pasando.",
  },
  {
    version: "8.86.0",
    date: "2026-04-26",
    type: "minor",
    title: "Refactor arquitectónico Fase 2: barrels unificados, content/, AuthContext modular",
    description: "Pasos 4-7 del plan de auditoría arquitectónica integral. (4) Convención de barrels estandarizada en src/services/: los 5 barrel-archivo (clienteService, embarqueServices, adminServices, proformaServices, cotizacionServices) se eliminaron y su contenido se movió a index.ts dentro de cada carpeta de dominio. Naming homogéneo (singular, sin sufijo Service/Services). 30+ imports en hooks, componentes y páginas actualizados a la convención @/services/<dominio>. (5) Reorganización editorial: src/data/changelog/ y src/data/changelogData.ts movidos a src/content/changelog/ y src/content/changelogData.ts respectivamente. src/data/ queda reservado a datasets de dominio (ports.ts y su test). (6) AuthContext.tsx (212 LOC) dividido en 4 archivos: useAuthSession (sesión + listener Supabase, ignorando TOKEN_REFRESHED para no invalidar React Query cada 60s), useAuthProfile (perfil + roles + organización vía RPC get_user_context con cache TTL e in-flight de-dupe), useLoginAudit (registro de login en bitácora con guarda sessionStorage) y AuthContext.tsx como compositor delgado (~85 LOC). (7) Auditoría de los 30 useEffect activos: todos legítimos, agrupados en 5 categorías documentadas en ARCHITECTURE.md (sincronización form, listeners, hidratación wizards, hooks utilitarios, shadcn read-only). ARCHITECTURE.md actualizado con secciones 'Convención de barrels' y 'Auditoría de useEffect'. Build verde y 201/201 pruebas pasando.",
  },
  {
    version: "8.85.0",
    date: "2026-04-26",
    type: "minor",
    title: "Refactor arquitectónico Fase 1: lazy-load completo de changelog + controllers de página",
    description: "Paso 1-3 del plan de auditoría arquitectónica integral (post v8.84.0). (1) Se extrajo todo el contenido de recentChangelog (770 LOC, versiones 8.0.0 a 8.84.0) al archivo src/data/changelog/v8.ts, alineándolo con la convención v1-v7. El módulo changelogData.ts queda en ~30 LOC con sólo la entrada actual eager y carga dinámica del resto vía import(), reduciendo el chunk lazy de /changelog. (2) Se añadió a ARCHITECTURE.md la sección 'Excepciones autorizadas' que documenta que mappers en lib/mappers/ pueden importar `type Tables` de Supabase y que `import type` no constituye violación de capa. (3) Se aplicó useListPageState (hook genérico ya existente) en Clientes.tsx y Proveedores.tsx eliminando estado local duplicado de search/page/pageSize. (4) Se creó src/hooks/reportes/useReportesPageController.ts absorbiendo los 5 useState + 3 useMemo + 2 handlers de Reportes.tsx, dejando la página como composición pura de UI (~70 LOC). (5) Se creó src/hooks/cliente/useClienteDetalleController.ts absorbiendo los 4 useState + 7 mutations + 3 handlers de ClienteDetalle.tsx. Build verde y 201/201 pruebas pasando.",
  },
];

/** Carga perezosa del bloque v8 completo (todas las entradas previas a la actual). */
export async function loadChangelogV8(): Promise<ChangelogEntry[]> {
  const mod = await import("./changelog/v8");
  return mod.changelogV8;
}

/** Carga perezosa del changelog histórico (v7.x y anteriores). */
export async function loadLegacyChangelog(): Promise<ChangelogEntry[]> {
  const mod = await import("./changelog/legacy");
  return mod.legacyChangelog;
}

/** Compat: array completo solo si se necesita explícitamente (no recomendado). */
export const changelog = recentChangelog;
