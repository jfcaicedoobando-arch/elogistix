# Eliminar módulo de Changelog (UI + chunks TS) → migrar a `CHANGELOG.md`

## Objetivo

Reducir el costo por loop ~20% eliminando la página `/changelog`, sus chunks TypeScript, controller, tests de integridad y la sidebar entry. Reemplazar todo por un único `CHANGELOG.md` en el root que se actualiza con una sola línea por release.

## Inventario

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| `src/pages/dashboard/Changelog.tsx` | Página UI |
| `src/components/dashboard/ChangelogEntryCard.tsx` | Card de cada entrada |
| `src/hooks/dashboard/useChangelogController.ts` | Controller (filtros/paginación/anclas) |
| `src/content/changelogData.ts` | `recentChangelog`, `dedupeByVersion`, loaders |
| `src/content/changelog/` (carpeta completa) | `legacy.ts`, `v1.ts` … `v8.ts`, `v4/chunks/0-3.ts`, `v8/chunks/0-6.ts` (~9.5k líneas total) |
| `src/content/__tests__/changelog.test.ts` | Tests de integridad del módulo |

### Archivos a EDITAR

| Path | Cambio |
|------|--------|
| `src/routes.tsx` | Quitar `const Changelog = lazy(...)` (línea 17) y `<Route path="/changelog" element={<Changelog />} />` (línea 135) |
| `src/components/layout/sidebarItems.ts` | Eliminar el item `{ title: "Changelog", url: "/changelog", icon: ScrollText }` (línea 50) |
| `src/components/layout/Breadcrumbs.tsx` | Eliminar `changelog: "Changelog"` del mapa (línea 22) |
| `src/hooks/layout/useAppSidebarSections.ts` | Reemplazar `it.url === "/ayuda" || it.url === "/changelog"` por sólo `it.url === "/ayuda"` (línea 42) |
| `src/hooks/dashboard/index.ts` | Quitar `export * from './useChangelogController';` |
| `src/pages/dashboard/Ayuda.tsx` | Quitar el `<p>` con el link a `/changelog` (líneas 144-147) |
| `src/constants/appVersion.ts` | Mantener `APP_VERSION` (lo usan Sentry, observability, portal, sidebar) pero actualizar el comentario (ya no se refiere al chunk0). |

### Archivos a CREAR

| Path | Contenido |
|------|-----------|
| `CHANGELOG.md` (root) | Formato [Keep a Changelog](https://keepachangelog.com/), encabezado breve + lista descendente. Se siembra con las **10 entradas actuales de `recentChangelog`** convertidas a Markdown (un `## [version] - YYYY-MM-DD` por entrada + bullet con summary; el descriptivo largo queda como párrafo). El resto del histórico (v1–v8 completos) NO se migra — quien lo necesite mira el git history. |

## Política nueva de mantenimiento

Cada cambio del agente que antes editaba 3 archivos (`APP_VERSION.ts` + `chunks/0.ts` + `changelogData.ts`) ahora hace **una sola edición**:

1. Bump `APP_VERSION` en `src/constants/appVersion.ts`.
2. Insertar una entrada nueva al inicio de `CHANGELOG.md`:
   ```md
   ## [11.30.0] - 2026-05-25
   - **Eliminación del módulo Changelog**: UI + chunks TS removidos, migrado a CHANGELOG.md. Ahorro ~20% por loop.
   ```
3. Sin description larga obligatoria — un bullet por cambio basta. Detalles técnicos opcionales como sub-bullets sólo si son críticos.

## Verificación

- `bunx tsc --noEmit` limpio (sin imports rotos a `@/content/changelogData` ni `@/hooks/dashboard/useChangelogController`).
- `bunx eslint src --max-warnings=0` sin warnings.
- `bunx vitest run` pasa — el conteo bajará de **633 a ~622** (11 tests del archivo `changelog.test.ts` removidos).
- `rg "useChangelogController|recentChangelog|loadChangelogMajor|loadLegacyChangelog|dedupeByVersion|ChangelogEntry|ChangelogEntryCard" src` → 0 resultados.
- `rg "/changelog" src` → 0 resultados.
- Navegar manualmente a `/changelog` debe dar 404 (NotFound route existente).
- Sidebar ya no muestra "Changelog"; "Ayuda" sigue visible.

## Memoria

- **Core (`mem://index.md`)**: cambiar la línea "Record all changes chronologically in `src/pages/Changelog.tsx`" por "Append a single entry to `CHANGELOG.md` (root) + bump `APP_VERSION`. Format: `## [vX.Y.Z] - YYYY-MM-DD` + bullet."
- **`mem://instructions/changelog-updates`**: reescribir con el nuevo procedimiento de 2 pasos; eliminar referencias a chunks, top-10, dedupe.

## Primer commit del nuevo flujo

Al final del refactor, agregar la entrada `11.30.0` en `CHANGELOG.md` documentando esta migración. Total: **bump `APP_VERSION` 11.29.0 → 11.30.0** + 1 línea en MD.
