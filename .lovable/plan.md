# Auditoría de Performance — Libre Carga

Análisis estático ejecutado por 3 subagentes paralelos (fetching, render, bundle). Sin cambios de código; este reporte propone qué optimizar y en qué orden.

## Resumen ejecutivo

Tres causas explican la mayor parte del "sluggish":
1. **Dashboard Ejecutivo dispara ~60 queries** para una sola carga (loop de 12 meses × 5 queries).
2. **Bundle inicial inflado** por imports eager de `@react-pdf/renderer` y `recharts`, sin `manualChunks`, más assets pesados en `public/`.
3. **Re-renders innecesarios** por contextos sin `useMemo`, keys inestables (`Math.random`, `Date.now`) y tablas sin virtualización.

---

## Hallazgos por capa

### A. Datos y red (Supabase / React Query)

1. **CRITICAL — `src/services/dashboard-ejecutivo/agregador.ts:63`**: N+1 — loop de 12 meses, cada uno llamando a `fetchEstadoResultadosDevengado` que ya hace 5 queries (~60 round-trips por carga). *Fix:* RPC `fn_eerr_12_meses(org_id)` que devuelva un JSON agregado en una sola llamada.
2. **HIGH — `src/services/admin/stats.ts:30-31`**: Descarga `organization_id` de toda la tabla `embarques`/`cotizaciones` para contar en JS. *Fix:* `.select('*', { count: 'exact', head: true })` agrupado, o RPC de conteos.
3. **HIGH — `src/services/profit/estadoResultadosDevengado.ts:157-165`**: 5 queries paralelas que pueden consolidarse en una vista. *Fix:* vista SQL / RPC unificada para EERR devengado.
4. **MEDIUM — `src/hooks/usuario/useUsuarios.ts:14`, `src/hooks/catalogos/useOperadoresDistintos.ts:10`**: catálogos con `staleTime: 0`, se refetchean en cada mount. *Fix:* `staleTime: 5–60 min` para catálogos casi inmutables.
5. **MEDIUM — `src/hooks/admin/useAdminOrgKpis.ts:14-29`**: 4 `useQuery` paralelas para KPIs admin. *Fix:* un solo hook + un solo RPC agregador.
6. **MEDIUM — `src/features/tesoreria/services/cuentas.ts:10`, `src/features/portal/services/queries.ts:157`, `src/features/embarques/services/eventos.ts:18`**: `.select("*")` y sin `.limit()` en tablas que crecerán. *Fix:* columnas explícitas + `.range()`.
7. **MEDIUM — `src/services/admin/stats.ts:28`**: `limit(500)` arbitrario en lista de organizaciones. *Fix:* paginación cursor/offset real.

### B. Render y main thread

8. **HIGH — `src/contexts/ThemeContext.tsx:46`**: `value={{ theme, toggleTheme }}` sin `useMemo` — todo consumidor re-renderiza con cada render del provider. *Fix:* envolver value en `useMemo` con deps explícitas.
9. **HIGH — `src/features/costeo/components/DemorasTarifaEditor.tsx:31` y `src/features/cotizacion/types/informativa.ts:40`**: keys con `Date.now()` / `Math.random()` → re-mount completo en cada render. *Fix:* ID estable del dominio o `useId()` una sola vez al crear.
10. **MEDIUM — `src/components/shared/DataTable.tsx`** (tablas estándar en Clientes/Cotizaciones >100 filas) vs `VirtualDataTable.tsx` ya existente. *Fix:* migrar a virtual cuando `rows > 50`. Además memoizar filas/celdas de `DataTableBody.tsx:102` con `React.memo`.
11. **MEDIUM — `src/components/ui/sidebar.tsx` (637 líneas)**: viola Power of 10 (≤200) y mezcla contexto + cookies + sub-componentes. *Fix:* dividir en sub-archivos.
12. **MEDIUM — `src/components/dashboard/EmbarquesActivosTable.tsx`**: parseo de fechas/estados en render path. *Fix:* `useMemo` con la transformación.

### C. Bundle y assets

13. **CRITICAL — `vite.config.ts:92`**: sin `manualChunks` ni `splitVendorChunkPlugin` → vendors estables (Radix, Tanstack, recharts) inflan entry o se duplican. *Fix:* `manualChunks` por grupo (`react-vendor`, `radix`, `charts`, `pdf`).
14. **HIGH — `src/pdf/render/descargarPdf.ts:12` y `src/pdf/render/PdfPreview.tsx:12`**: import eager de `@react-pdf/renderer` (~250–450 KB). *Fix:* `await import("@react-pdf/renderer")` dentro de la función y `React.lazy` para `PDFViewer`.
15. **HIGH — `public/changelog.json` (274 KB)**: asset huérfano. *Fix:* eliminar o cargar bajo demanda.
16. **MEDIUM — `src/index.css:1`**: Google Fonts vía `@import` bloquea CSS. *Fix:* `<link rel="preconnect">` + `<link rel="stylesheet">` en `index.html` con `font-display: swap`.
17. **MEDIUM — `index.html`**: sin `preload` para logo LCP ni fuente Inter. *Fix:* `<link rel="preload" as="image" fetchpriority="high">` + preload de Inter woff2.
18. **MEDIUM — `public/librecarga-logo.png` (154 KB)** cuando existe `librecarga-logo.svg` (<1 KB). *Fix:* usar SVG o WebP/AVIF.
19. **MEDIUM — `src/components/reportes/*.tsx`**: `recharts` eager (~150 KB gzip). *Fix:* `React.lazy` por cada gráfica.
20. **LOW — Barrel exports en `src/features/**/index.ts`**: riesgo de romper tree-shaking. *Fix:* `"sideEffects": false` en `package.json` y/o importar desde submódulos.

### Positivo
- `xlsx` y `Sentry` ya usan import dinámico / idle (`src/main.tsx`).
- Existe `VirtualDataTable` listo para adoptar.
- Existe `scripts/check-bundle-size.sh` con gates duros (250 KB lazy / 500 KB vendor) — falta enforcement en CI bloqueante.

---

## Recomendaciones priorizadas (orden sugerido)

```text
Fase 1 — Quick wins de bundle (1 sesión)
  1.1  manualChunks en vite.config.ts                 [#13]
  1.2  Lazy de @react-pdf/renderer + PDFViewer        [#14]
  1.3  Eliminar public/changelog.json + logo SVG      [#15, #18]
  1.4  Preload de LCP + preconnect a Google Fonts     [#16, #17]

Fase 2 — Fetching del Dashboard (1 sesión, requiere migración SQL)
  2.1  RPC fn_eerr_12_meses → agregador.ts            [#1]
  2.2  Vista materializada / RPC para EERR devengado  [#3]
  2.3  RPC agregador para admin KPIs                  [#5]
  2.4  Conteos head:true en admin/stats.ts            [#2, #7]

Fase 3 — Render hygiene (1 sesión)
  3.1  useMemo en ThemeContext value                  [#8]
  3.2  Eliminar Math.random / Date.now en keys        [#9]
  3.3  React.memo en filas de DataTableBody           [#10]
  3.4  Migrar tablas grandes a VirtualDataTable       [#10]
  3.5  useMemo de transforms en EmbarquesActivosTable [#12]

Fase 4 — Higiene de caché y partición (1 sesión)
  4.1  staleTime: 30 min en catálogos                 [#4]
  4.2  Columnas explícitas + .range() en tesorería/portal/eventos [#6]
  4.3  Partir sidebar.tsx (637 → ≤200)                [#11]
  4.4  Lazy de recharts por gráfica                   [#19]
  4.5  sideEffects:false en package.json              [#20]
```

## Validación esperada tras cada fase
- **Fase 1**: bundle entry ↓ 30–40 %, FCP/LCP medibles vía `browser--performance_profile`.
- **Fase 2**: carga del Dashboard Ejecutivo de ~60 requests a 1–3; TTI ↓ 60 %.
- **Fase 3**: re-renders por interacción medibles con React DevTools Profiler, tablas grandes a <16 ms/frame.
- **Fase 4**: refetches por mount eliminados en catálogos; bundle vendor < 500 KB gzip.

## Fuera de alcance de este reporte
- Optimización de queries SQL específicas (requiere `EXPLAIN ANALYZE` con `supabase--slow_queries`).
- Compute sizing de Lovable Cloud — si tras Fase 2 persiste lentitud DB, considerar upgrade de instancia.
- Rediseño de componentes UI por accesibilidad/UX.
