# Plan · Correcciones UI/UX (basado en `instrucciones-lovable-uiux.md`)

## Verificación previa

He auditado el repo antes de planear. Los hallazgos son bugs reales:

- **FIX-UX-01 (errores de red silenciosos):** el `QueryCache.onError` en `src/lib/query/queryClient.ts:74-88` solo llama a `reportQueryError` (Sentry); no dispara toast. `rg -l isError src/features -g "*.tsx"` devuelve **29** archivos → la gran mayoría de rutas nunca renderiza estado de error.
- **FIX-UX-08 (timezone en `addDays`):** confirmado en `src/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers.ts:26-35`. Se parsea local (`new Date(iso + "T00:00:00")`) y se serializa con `toISOString()` (UTC) → al oeste de UTC (America/Mexico_City, -06/-07) se resta un día al `vencimiento`.
- **FIX-UX-04:** `rg -l 'type="number"' src` da **44** archivos, y el sustituto (`NumericInput`) solo aparece en ~9. Coincide con la auditoría.
- **FIX-UX-02 / 03 / 05 / 06 / 07 / 09:** los archivos citados existen y siguen sin diálogos, sin `htmlFor`, sin `aria-label` o con grids no responsivas. Son bugs reales.

Dado el tamaño, propongo ejecutarlo en 4 fases entregables (cada fase pasa `typecheck + lint + tests` y bump de `APP_VERSION` + `CHANGELOG.md`).

---

## Fase 1 — Bugs críticos y de bajo costo (P0)

**Objetivo:** cero riesgo de datos incorrectos y visibilidad inmediata de fallas de red.

1. **FIX-UX-08 · `addDays` timezone-safe**
  - Reescribir sin `toISOString()`: aritmética por componentes con `date-fns/format` (o string-math) para devolver siempre `YYYY-MM-DD` local.
  - Añadir `env: { TZ: "America/Mexico_City" }` a `vitest.config.ts`.
  - Test unitario que corra con `TZ=UTC` y `TZ=America/Los_Angeles`.
2. **FIX-UX-01 · Errores visibles con reintento**
  - En `queryClient.ts` `QueryCache.onError`: además de Sentry, `toast.error(...)`, respetando `meta.silentError`.
  - Extender `DataTable` con props opcionales `isError`/`onRetry` que renderice `ErrorStateInline`.
  - Aplicar rama `if (isError) return <ErrorState ... onRetry={refetch} />` en las páginas de alto impacto listadas:
    - `useEmbarquesPageState.ts` (`isEmptyState && !isError`)
    - `features/cxp/routes/Cxp.tsx`
    - `features/facturacion/routes/FacturaDetalle.tsx` (distinguir "no existe" vs error de red)
    - `features/dashboard/hooks/useDashboardData.ts` (consumidores)
    - `features/portal/routes/PortalFacturas.tsx` + otras 6 rutas del portal (`/portal/*`)
  - No tocamos las ~180 páginas restantes en esta fase; queda documentado como deuda.

**Aceptación fase 1:** DevTools offline → cada ruta del listado muestra `ErrorState` con "Reintentar". Tests TZ pasan con cualquier TZ del runner. Toast aparece una sola vez por error (dedupe por meta).

---

## Fase 2 — Confirmaciones destructivas + captura de dinero (P1)

3. **FIX-UX-02 · `ConfirmActionDialog` en acciones destructivas**
  - Cancelar NC (`cxp/components/NotasCreditoSection.tsx`)
  - Eliminar en `TabPuertos`, `TabNavieras`, `TabTiposContenedor`, `CatalogoClavesSATCard`
  - Eliminar concepto en `FacturaConceptosEditor`
  - Donde el registro esté referenciado por embarques/facturas, deshabilitar botón + tooltip "En uso" (una sola consulta previa por catálogo).
4. **FIX-UX-04 · `NumericInput` para dinero**
  - Extender `NumericInput` si falta: formateo `1,234.56` en blur, parseo tolerante al pegar, permite vacío, valida `Number.isFinite`.
  - Migrar los 5 archivos de mayor uso listados en la auditoría; el resto queda como "seguir migrando por módulo" en Fase 4.
  - Añadir regla eslint custom o `no-restricted-syntax` que prohíba `type="number"` en `src/features/**/*.tsx` (con excepciones documentadas).

**Aceptación fase 2:** 0 acciones destructivas sin diálogo en los archivos listados; scroll sobre campos de dinero no muta el valor; se puede vaciar el campo.

---

## Fase 3 — Accesibilidad y responsive (P2)

5. **FIX-UX-03 · Labels `htmlFor**`
  - Refactor de `components/shared/FormField.tsx` para generar `useId()` y propagarlo al hijo control vía `cloneElement`, pasando `htmlFor` al `Label`.
  - Activar `eslint-plugin-jsx-a11y` con `label-has-associated-control` en warning primero (para no romper CI), y corregir por módulo: facturación → cotización → CxP.
6. **FIX-UX-05 · `aria-label` en botones-ícono**
  - Corregir los 3 archivos listados.
  - Activar regla `jsx-a11y/control-has-associated-label` / `button-has-aria-label` en el mismo commit.
7. **FIX-UX-06 · Tablas con scroll**
  - Migrar `TablaFlujoSemanal.tsx` y `CrmDashboard.tsx` a `DataTable` (o envolver en `overflow-x-auto` si no aplica).
  - ADR corto en `ARCHITECTURE.md` declarando `DataTable` como puerta única.
8. **FIX-UX-07 · Grids financieros responsive**
  - Ajustar los 4 archivos citados a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N`, reutilizando `KpiStrip` donde aplique.

**Aceptación fase 3:** lint a11y sin errores nuevos; a 375 px ninguna de las páginas listadas presenta overflow horizontal; `<table>` cruda queda solo en módulos aún no migrados (documentado).

---

## Fase 4 — Pulido y limpieza (P3, opcional)

9. **FIX-UX-09**
  - Migrar `Loader2` de nivel-página a `PageSkeleton`/`LoadingState` (por módulo, no bloqueante).
  - `mode: "onBlur"` en los `useForm` sin `mode`.
  - Ampliar touch targets `h-6/h-7/h-8` en celdas a `h-10 w-10` o padding clicable.
  - Decidir `"use memo"`: quitar directivas muertas.
  - `manualChunks` para `xlsx`, `remotion`, `recharts` en `vite.config.ts`.
10. **FIX-UX-10 · ADR i18n**
  - `docs/adr/0001-es-mx-hardcoded.md` con la decisión.

---

## Detalles técnicos clave

- **Toast dedupe (fase 1):** `sonner` ya deduplica por `id`; usaremos `id: "query-error-" + queryKey[0]` para no spamear si varias queries fallan en cascada.
- **Distinguir "no existe" vs error de red en `FacturaDetalle`:** el hook actual ya sabe si vino `data === null` con status ok (PGRST 200 vacío) vs `error`. Renderizar 404 solo si `!isError && !data`, sino `ErrorState`.
- `**NumericInput` sin regresiones:** exponer prop `allowEmpty` (default true). Los consumidores actuales pasan `value ?? ""`; blindarlos.
- **eslint plugin a11y:** se instala `eslint-plugin-jsx-a11y` (Fase 3), con reglas nuevas en `warn` primero y luego `error` una vez limpio.
- **CHANGELOG / APP_VERSION:** un bump por fase (`13.303.75`, `.76`, `.77`, `.78`).

## Fuera de alcance

- No tocaremos las 200+ rutas restantes sin `isError` en fase 1 (solo las críticas del listado); el resto se abre como deuda para migrar por módulo.
- No cambiaremos el motor de queries ni introduciremos ErrorBoundary por ruta (ya existe global).
- No haremos i18n real (fase 4 sólo documenta la decisión).

## Preguntas antes de ejecutar

Puedo arrancar por Fase 1 (bugs P0) para minimizar riesgo, o ejecutar las 4 fases seguidas. ¿Confirmas orden `1 → 2 → 3 → 4` y que puedo empezar por Fase 1 en el próximo turno? Ejecuta todas las fases