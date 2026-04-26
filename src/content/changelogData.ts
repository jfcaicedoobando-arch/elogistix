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
