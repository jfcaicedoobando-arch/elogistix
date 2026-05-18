# Auditoría arquitectónica integral — Reporte read-only (sin cambios de código)

Snapshot del estado del repo en versión **8.204.0**.

## Resumen ejecutivo

La base está en muy buena forma comparada con auditorías previas:

- **0** warnings ESLint en la config actual, **0** llamadas Supabase en `pages/` y prácticamente **0** en `components/` (un solo archivo restante).
- **0** ocurrencias de `: any`, `console.log`, `TODO/FIXME` en código productivo.
- **369/369** tests en verde, separación general por dominio bien definida (`components / hooks / services / lib / generators / pages`).

Lo que queda por pulir es deuda arquitectónica **estructural**, no urgente: barrel imports, mappers/servicios "god", `src/utils` huérfano, `eslint-disable react-hooks/exhaustive-deps`, hooks de embarque grandes, y baja cobertura de tests en `services/`.

## Hallazgos por categoría

### 1. Separación de capas (✅ bien, salvo excepciones)

- **`src/components/embarque/TabTracking.tsx`** importa `@/integrations/supabase` directamente. Único componente que rompe la regla "Supabase sólo en `services/` y `hooks/`". Debe pasar por un hook/servicio.
- **`src/generators/`** (PDF) consulta Supabase en 5 archivos (`estadoCuentaPdf.ts`, `proformaPdf.ts`, `layoutContable.ts`, `proforma/{consolidada,header}.ts`). Los generadores deberían recibir datos ya hidratados; mezclan I/O con presentación.
- **`src/types/`** (11 archivos) y **`src/lib/domain/`** (17 archivos) conviven con criterios inconsistentes: `cotizacion.ts` está en ambos, `embarque.ts` también. Falta una regla clara (sugerido: `types/` para tipos puros de DB/forms; `lib/domain/` para lógica + invariantes).

### 2. Carpetas duplicadas / huérfanas

- **`src/utils/orgExportZip.ts`** existe sólo como shim `@deprecated` que reexporta de `services/admin/exportOrg` + `lib/io/`. La carpeta `src/utils/` puede eliminarse y dejar todo en `lib/utils/` + `lib/io/` (pendiente **P1.5** del plan histórico).
- **50 archivos `index.ts`** (barrels) + **28 `export *`** → riesgo de ciclos y bundles inflados; ya hay **168 violaciones** de `no-restricted-imports` (down de 203 pero lejos del 0 objetivo, **P0.1**).

### 3. Hooks demasiado grandes / acoplados

Top de hooks `>200` líneas mezclando varias responsabilidades:

| Hook | LOC | Síntoma |
|---|---|---|
| `useNuevoEmbarqueWizard.ts` | 260 | Orquesta estado + validación + submit + side-effects |
| `useEmbarquesPageState.ts` | 254 | Filtros + selección + bulk actions (no se completó split P2.12) |
| `useJsonCargoTracking.ts` | 250 | Fetch + normalize + sync + UI flags |
| `useAuditoriaEjecutivo.ts` | 256 | Agregados + filtros + derivaciones |
| `useTrackingLiveCard.ts` | 209 | Controller razonablemente cohesivo, en el límite |
| `useEmbarquesPageController.ts` | 197 | OK pero acoplado al state |

### 4. Lógica mal ubicada

- **`src/components/admin/DiagnosticoHealthPanel.tsx`** (258 LOC): contiene lógica de cómputo de salud que debería vivir en `lib/domain/diagnostico.ts` o `services/observability/`.
- **`src/components/shared/BitacoraActividad.tsx`** (253 LOC): mezcla query + filtros + render; el query/transform debería estar en `hooks/shared/useBitacoraActividad.ts`.
- **`src/lib/parsers/dashboard.ts`** (201 LOC): mezcla parseo + agregación + formato. Separar parseo (zod) y agregación.
- **`src/lib/formatters/index.ts`** (243 LOC): es un god-module; falta partir por dominio (`money`, `date`, `location`, `pesos`).

### 5. Complejidad — pendiente real (no visible con el threshold actual)

`bunx eslint --rule complexity:["warn",12]` revela **31 warnings** ocultos por el threshold de 15. Hotspots conocidos por el plan histórico:

- `lib/mappers/embarqueFromDb.ts` (cx 46), `embarqueToDb.ts` (cx 41), `cotizacionForm.ts` (cx 35), `cotizacion.ts` (cx 33).
- `services/facturas/proyeccion.ts`, `services/cotizacion/mutations.ts`, `services/facturas/huecoFacturacion.ts`.

### 6. `eslint-disable react-hooks/exhaustive-deps` (10 ocurrencias)

Concentradas en wizards y controllers — cada una es deuda implícita:

- `useEditarEmbarqueWizard.ts` (×3), `useCotizacionWizardSteps.ts`, `useEmbarqueEstadoActions.ts`, `useAuditoriaSnapshots.ts`, `usePortalEmbarquesController.ts`, `useListPageState.ts`, `AuthContext.tsx`, `DialogBolContainers.tsx`.

### 7. Tests

- **3 suites en `services/`** (csf, idempotency, tracking) sobre 66 servicios → cobertura de la capa más crítica está bajísima (meta plan: ≥10).
- **0 E2E** del Portal cliente, conciliación financiera y export ZIP.

### 8. Routing / `App.tsx`

- 238 LOC, todo lazy-loaded, bien organizado, pero los `ProtectedRoute allowedRoles={[...]}` están repetidos in-line. Podría extraerse `routes.config.ts` por sección para mejorar mantenibilidad y SEO de rutas.

## Recomendaciones ordenadas (crítico → opcional)

### Crítico (P0)

1. **Cerrar barrel imports**: pasar 168→0 violaciones de `no-restricted-imports`. Ampliar `index.ts` en cada `hooks/<dominio>/` y `services/<dominio>/`, ejecutar codemod de reemplazo. Una vez en 0, subir la regla a `error`.
2. **Romper mappers de alta complejidad** (`embarqueFromDb` cx 46, `embarqueToDb` cx 41, `cotizacionForm` cx 35, `cotizacion` cx 33): partir en `parseDb()` + `mapDbToDomain()` + `applyDefaults()` con schemas zod. Reduce el riesgo de bugs silenciosos al cambiar la DB.
3. **Mover Supabase fuera de `components/embarque/TabTracking.tsx`** a un hook/servicio. Es la última violación de la regla de capas.
4. **Sacar Supabase de `src/generators/`** (5 archivos). Cada generador debe recibir un DTO ya hidratado; los fetches viven en `services/<dominio>/exports.ts`.

### Alta (P1)

5. **Resolver los 10 `eslint-disable react-hooks/exhaustive-deps`** uno por uno (refactor a `useCallback`/`useEvent` o moviendo lógica a effects con deps explícitas). Empezar por `AuthContext` y `useEditarEmbarqueWizard`.
6. **Unificar `src/utils/` + `src/lib/utils/`** en `lib/utils/` + `lib/io/`. Borrar el shim `orgExportZip.ts`.
7. **Romper servicios "god"**: `services/facturas/proyeccion.ts` (cx 41), `services/cotizacion/mutations.ts` (cx 29), `services/facturas/huecoFacturacion.ts` (cx 28). Subcarpetas por operación.
8. **Particionar hooks >200 LOC** que mezclan concerns: `useNuevoEmbarqueWizard` (split state/validation/submit), `useEmbarquesPageState` (filters / selection / bulk), `useJsonCargoTracking` (fetch / sync / flags), `useAuditoriaEjecutivo` (queries / aggregations).
9. **Schemas zod para respuestas Supabase críticas** (embarques, facturas, cotizaciones). Reemplazar `fromDb<T>()` por `parse()` para detectar drifts contra la BD.

### Media (P2)

10. **Aclarar regla `types/` vs `lib/domain/`** y mover tipos duplicados (`cotizacion.ts`, `embarque.ts`). Documentar en `docs/architecture-map.md`.
11. **Partir `lib/formatters/index.ts`** (243 LOC) en `money.ts`, `date.ts`, `location.ts`, `pesos.ts`. Mantener barrel para compatibilidad.
12. **Extraer lógica de `DiagnosticoHealthPanel`** a `lib/domain/diagnostico.ts` y de `BitacoraActividad` a `hooks/shared/useBitacoraActividad.ts`.
13. **Subir cobertura de `services/`** de 3 a ≥10 suites. Priorizar: `embarque/queries`, `cotizacion/mutations`, `facturas/proyeccion`, `auditoria`, `csf`.
14. **Endurecer ESLint**: bajar `complexity` 15→12 una vez resueltos los 31 warnings ocultos; promover `no-restricted-imports` a `error`.

### Opcional (P3)

15. **Refactor `App.tsx`** extrayendo `routes/{admin,portal,app}.tsx` o un `routes.config.ts`.
16. **Patrón `Result<T,E>`** en servicios para eliminar `try/catch` en hooks.
17. **Convención de nombres**: `useXController` (orquesta) vs `useXState` (estado) vs `useXData` (query). Documentar.
18. **E2E nuevos**: conciliación financiera, portal cliente end-to-end, export ZIP de organización.
19. **Auditar `eslint-disable` no relacionados a deps** (10 ocurrencias en archivos varios) y removerlos si ya no aplican.

## Métricas objetivo

| Métrica | Hoy | Meta |
|---|---|---|
| ESLint warnings (config actual) | 0 | 0 ✅ |
| ESLint warnings (complexity ≤12) | 31 | <5 |
| Barrel violations (`no-restricted-imports`) | 168 | 0 |
| Supabase en `components/` | 1 | 0 |
| Supabase en `generators/` | 5 | 0 |
| `eslint-disable exhaustive-deps` | 10 | 0 |
| Hooks productivos >200 LOC | 6 | ≤2 |
| Test suites en `services/` | 3 | ≥10 |

## Fuera de alcance de esta auditoría

- Cambios de DB/RLS, decisiones de UX, performance runtime, accesibilidad, i18n adicional, SEO/meta.

