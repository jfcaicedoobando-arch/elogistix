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
