# Plan de remediación — Auditoría de calidad

18 hallazgos agrupados en **5 fases**. Cada fase es independiente y entregable por separado (lint + tests + version bump + CHANGELOG). El orden prioriza **riesgo operacional → divergencia silenciosa → mantenibilidad → estética**.

---

## Fase 1 — Riesgos operacionales (CRITICAL)

*Cosas que ya están causando bugs o ruido en producción.*

1. **Sentry DSN a env var** — `src/lib/sentry.ts:17`
  - Crear `VITE_SENTRY_DSN` en `.env` y leer con `import.meta.env`.
  - Si no está definida, no inicializar Sentry (evita ruido de dev).
  - Documentar en `.env.example`.
2. `**DEFAULT_PAGE_SIZE` único** — 4 declaraciones divergen (100/100/100/**50**)
  - Fuente de verdad: `src/hooks/shared/useListPageState.ts` (ya exporta `DEFAULT_PAGE_SIZE = 100`).
  - Reemplazar en `useEmbarquesFilters.ts:16`, `useTabProformasState.ts:8`.
  - En `pages/admin/Diagnostico.tsx:18` renombrar a `DIAGNOSTICO_PAGE_SIZE = 50` con comentario.
3. **Tracking URL deriva de `VITE_SUPABASE_URL**` — `src/services/tracking/index.ts:46`
  - Replicar patrón de `src/services/csf/index.ts:25`.
  - Eliminar dependencia implícita de `VITE_SUPABASE_PROJECT_ID`.
4. `**cargarEmisorEmpresa` fuera de `src/pdf/**` — `src/pdf/emisor.ts:32-47`
  - Crear `src/services/configuracion/emisor.ts` con `fetchEmisorEmpresa()` reusando `fetchConfiguracion()` (o nuevo `fetchConfiguracionByCategoria`).
  - Cache vía React Query (`staleTime`), no in-memory TTL.
  - Call sites: `proformaPdf.tsx`, `estadoCuentaPdf.ts` reciben `EmisorInfo` como parámetro.

**Verificación fase 1:** `bun run lint`, `bunx vitest run`, smoke test PDF + tracking link + Sentry init.

---

## Fase 2 — Divergencia silenciosa entre módulos (CRITICAL/HIGH)

*Código duplicado que ya está divergiendo y producirá bugs financieros/de export.*

5. **Unificar `fetchSources.ts` de facturas** — proyección ↔ hueco
  - Crear `src/services/facturas/shared/fetchEmbarquesRango.ts(orgId, { dateColumn: 'eta'|'etd', ... })`.
  - Crear `fetchConceptosBase(ids, expedientes)` compartido.
  - Ambos módulos delegan; preservar firmas públicas.
6. **Unificar `updateConfigItems**` — `src/services/configuracion/index.ts:51-88`
  - Helper privado `updateConfigItems(table, items)` con overloads tipados.
  - Resolver divergencia de `JSON.parse(JSON.stringify(...))` decidiendo si es necesario en ambas o ninguna.
7. **Export CSV vs paginados de embarques** — `exportListado.ts` ↔ `paginados.ts`
  - Opción A (preferida): añadir soporte `p_limit = null` al RPC `embarques_listado` y delegar.
  - Opción B (si migración DB no deseable ahora): extraer función pura `buildEmbarquesFilters(params)` y compartirla, manteniendo dos call sites.
  - Requiere coordinar migración Supabase — decidir A vs B antes de implementar.

**Verificación fase 2:** tests de reportes/proyección, export CSV manual comparado contra UI.

---

## Fase 3 — Complejidad y robustez (HIGH)

*Funciones frágiles que silenciosamente devuelven resultados incorrectos.*

8. `**errorDetailsExtract.ts**` — strategy table + `WeakSet` para `findZodError`.
9. `**parseCsv.ts**` — state machine `NORMAL | IN_QUOTE | ESCAPE`. Mantener tests existentes verdes.
10. `**services/crm/actividades.ts:26**` — filter builder con params object en lugar de `let q` mutable.
11. `**embarquesEstadoDialog/extras.ts:10**` — `Record<EstadoUiKey, fn>` lookup.
12. `**hallazgosTablaFilters.ts:45**` — `switch` con `default: filtro satisfies never` para exhaustividad.

**Verificación fase 3:** tests existentes + añadir tests unitarios donde no existen (CSV parser, errorDetails, filtros auditoría).

---

## Fase 4 — Separación de responsabilidades y duplicación menor (HIGH)

*Refactors mecánicos que reducen acoplamiento.*

13. **Controllers para páginas god**
  - `usePapeleraController` (extrae de `pages/admin/Papelera.tsx`).
    - `usePortalFacturasController` + `usePortalCotizacionesController` (espejando `usePortalEmbarquesController`).
    - Mover `invalidateQueries` de `pages/clientes/Clientes.tsx` al hook de mutation.
14. **Utilidad `uniqueSorted**` — `src/lib/utils/uniqueSorted.ts` con `localeCompare('es-MX')`. Reemplazar 6 call sites.
15. **Constante `FILTER_ALL**` — `src/constants/filters.ts` con `FILTER_ALL = 'todos' as const`. Preservar compatibilidad con URLs serializadas.
16. **Mover `eventoSchema**` de `TrackingNuevoEventoForm.tsx:18` a `src/lib/validation/mutationSchemas.ts`.
17. **Extraer CSV de `useTabProyeccionController.ts:89**` → `src/lib/facturacion/proyeccionCsv.ts` (espejo de `huecoCsv.ts`).
18. **Constantes de negocio**
  - `src/constants/auditoria.ts` → `SCORE_THRESHOLDS` (90/75/60).
    - `src/constants/reportes.ts` → `MARGIN_THRESHOLDS` (20/10).
    - `src/constants/carriers.ts` → `CARRIER_TRACKING_URLS` (extraer de `externalTracking.ts`).

**Verificación fase 4:** lint, tests, snapshot manual de páginas afectadas.

---

## Fase 5 — Limpieza estética y naming (OK/HIGH bajo)

*Reduce ruido visual, sin impacto funcional.*

19. **Renombrar a PascalCase**:
  - `adminOrganizacionesColumns.tsx`, `adminUsuariosColumns.tsx`, `diagnosticoColumns.tsx`
    - `cotizacion/columnsParts/accionesCell.tsx`, `estadoVigenciaCell.tsx`
    - Hacerlo con `git mv` (case-sensitive) para evitar problemas en macOS.
20. `**SeccionMercanciaMaritimeLCL.tsx` → `SeccionMercanciaMaritimaLCL.tsx**` (consistencia es).
21. **Borrar comentarios muertos**:
  - `src/integrations/supabase/client.ts:9` (import comentado).
    - Section headers vacíos en `useTabProformasController.ts:55-67`.
    - Auditar y limpiar bloques `(legacy)` realmente no usados en `stylesContent.ts`.
22. **Split de `src/components/ui/sidebar.tsx` (637 líneas)** — opcional; es vendored shadcn, valorar costo/beneficio. Si se hace: subcarpeta `sidebar/` con barrel.
23. **Marcar `supabase/types.ts**` con header `// @generated` (sin tocar contenido).

**Verificación fase 5:** lint, tests, verificar imports actualizados (TS detecta).

---

## Orden recomendado

```text
Fase 1  →  Fase 2  →  Fase 3  →  Fase 4  →  Fase 5
(ops)      (riesgo    (robustez) (refactor) (cosmético)
            $$$)
```

**Por qué este orden:**

- **Fase 1** elimina ruido en Sentry y bugs ya latentes (page size divergente, tracking URL frágil).
- **Fase 2** ataca duplicación que **ya divergió** — cada día que pasa empeora.
- **Fase 3** previene bugs silenciosos (CSV mal parseado, filtros que devuelven todo).
- **Fase 4** es refactor mecánico de bajo riesgo pero alto volumen — mejor cuando ya no compites con bugs urgentes.
- **Fase 5** es cosmética; última prioridad pero útil como "warm-up" entre fases pesadas.

## Notas técnicas

- Cada fase = 1 commit + bump `APP_VERSION` (12.16.4, .5, .6, .7, .8) + entrada en `CHANGELOG.md`.
- Mantener Power of 10: componentes ≤200 líneas, no `any`, cleanup en effects.
- Cualquier nuevo `style={{...}}` está prohibido (mem://principles/inline-styles).
- Fase 2 punto 7 requiere decisión previa: ¿migración DB para `embarques_listado` (Opción A) o helper compartido sin tocar DB (Opción B)?

## Fuera de alcance

- No se incluye refactor de `supabase/types.ts` (auto-generado).
- No se renombra carpeta `org-detalle/` (kebab-case, OK severity — costo de mover imports no justifica).
- No se mueve `ErrorDetailsDialog.tsx` ni se renombra shim `costosPLTypes.ts` (bajo impacto).

## Decisión pendiente antes de empezar Fase 2

**Opción A** (RPC con `p_limit` nullable, requiere migración Supabase) vs **Opción B** (helper TS compartido, sin tocar DB). Recomiendo **B** para reducir superficie de cambio; A queda como mejora futura.