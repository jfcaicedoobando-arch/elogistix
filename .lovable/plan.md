# Auditoría arquitectónica — Libre Carga ERP v8.195.0

Sprints P0.1–P0.4, P1.5, P1.6, P2.9, P2.11 cerrados (8.193.0 → 8.195.0).
Estado: **35 warnings ESLint** (de 265 iniciales). Pendientes documentados abajo.

> Análisis inicial sobre **637 archivos TS/TSX**, **40 suites de tests**, **265 warnings** (0 errores).

## 1. Estado general

**Lo que está sano:**
- Separación clara `pages → hooks (controllers) → services → lib (puro)` documentada en `ARCHITECTURE.md` y reforzada con guardas ESLint (Power of 10, max-lines 250, complexity 15, prohibido `any`).
- 0 `as any` fuera de changelogs; mappers Supabase aislados en `lib/mappers/*`.
- RLS multi-tenant + observabilidad + 359 tests verdes.
- Solo **3 archivos** llaman a `supabase` directo desde `components/` o `pages/` (Papelera, Idempotencia, ErrorBoundary) → acoplamiento bajo.
- Sólo **2 archivos** superan los 250 LOC (`BulkImportDialog 319`, `embarqueWizardSchemas 298`) y ambos son justificables.

**Donde duele:**
- **203 warnings de barrel violations** — la regla `no-restricted-imports` ya está activa pero hay deuda histórica importando `@/hooks/<dominio>/<archivo>` en lugar del barrel.
- **38 warnings de complejidad ciclomática** con picos extremos (46, 41, 41, 35, 33) en mappers, wizard y servicios de facturación/cotización.
- **9 `react-hooks/exhaustive-deps`** silenciados — riesgo de stale closures.
- **11 `react-refresh/only-export-components`** — exports mezclados rompen HMR.
- **Carpetas duplicadas** `src/utils/` (1 archivo) vs `src/lib/utils/` (1 archivo) vs `src/lib/utils.ts` → tres ubicaciones para "utilidades".
- `src/services/cotizacion/conversiones/` es la única subcarpeta dentro de servicios → inconsistencia: otros dominios mantienen archivos planos.
- Sin documento `coverage` por dominio; tests concentrados en `lib/` y poco en `services/` (solo 2 suites).

## 2. Hallazgos por categoría

### 2.1 Lógica fuera de lugar (misplaced logic)

| Caso | Ubicación actual | Debería estar en |
|------|------------------|-------------------|
| `Papelera.tsx` y `Idempotencia.tsx` hacen queries Supabase inline | `pages/dashboard/` | Mover a `services/admin/papelera.ts` + hook controlador |
| `ErrorBoundary.tsx` llama `supabase.from('app_logs')` | `components/shared/` | Extraer a `services/observability/logError.ts` |
| `utils/orgExportZip.ts` (queries paginadas + UI download) | `src/utils/` | Dividir: queries → `services/admin/exportOrg.ts`, ZIP/download → `lib/io/zipDownload.ts` |
| `lib/utils.ts` (6 líneas, `cn()`) vs `lib/utils/htmlEscape.ts` | dispersos | Unificar bajo `lib/utils/` con barrel |
| `hooks/use-toast.ts` (186 LOC) | raíz de hooks | Mover a `hooks/shared/` con el resto de utilidades transversales |

### 2.2 Acoplamiento y separación de capas

- Pages → hooks: correcto en la mayoría, pero `Papelera`/`Idempotencia` saltan la capa de servicio.
- Hooks → services: **203 violaciones de barrel** rompen la indirección y dificultan refactors (cambiar un archivo interno obliga a tocar N consumidores).
- `lib/mappers/*` mezcla cast + transformación + validación en funciones de 46 de complejidad (`embarqueFromDb`, `embarqueToDb`, `cotizacionForm`, `cotizacion`). Falta separar: parsing zod ↔ mapping ↔ defaults.
- `services/cotizacion/mutations.ts` y `services/facturas/proyeccion.ts` concentran toda la lógica de negocio en funciones gigantes (>30 complejidad).

### 2.3 Complejidad excesiva (top ofensores)

| Archivo | Complejidad | Naturaleza |
|---------|-------------|-----------|
| `lib/mappers/embarqueFromDb.ts` | 46 | switch + defaults inline |
| `services/facturas/proyeccion.ts` | 41 | agregaciones + ramas por estado |
| `lib/mappers/embarqueToDb.ts` | 41 | mismo patrón inverso |
| `lib/mappers/cotizacionForm.ts` | 35 | hidratación de form RHF |
| `lib/mappers/cotizacion.ts` | 33 | mapeo + cálculos |
| `services/cotizacion/mutations.ts` | 29 | crear/editar mezclados |
| `services/facturas/huecoFacturacion.ts` | 28 | detector de huecos |
| `lib/domain/proyeccionFacturacion.ts` | 27 | reglas mes a mes |
| `pages/auth/TrackingPublico.tsx` | 28 | UI + estados de red |
| `lib/jsoncargo/navieras.ts` | 25 | mapping API externa |

### 2.4 Correctness / riesgos sutiles

- 9 `exhaustive-deps` desactivados → revisar cada `eslint-disable-next-line` por stale state.
- 11 `react-refresh/only-export-components` → archivos exportan componente + helper/constant; HMR pierde estado en dev.
- Mappers usan `fromDb<T>()` (cast wrapper) pero sin schema `zod` que valide la forma → si Supabase cambia el shape, falla en runtime, no en build.
- `src/lib/utils.ts` solo contiene `cn()` (6 líneas) → candidato a fusionar.

## 3. Plan priorizado (sin código aún)

### P0 — Crítico (Sprint 1, ~1 semana)

1. **Cerrar barrel violations (203 warnings)** — crear/ampliar barrels en cada `hooks/<dominio>/index.ts` faltante y reemplazar imports por path corto. ROI alto, riesgo bajo.
2. **Mover queries Supabase fuera de pages** — `Papelera`, `Idempotencia`, `ErrorBoundary` → nuevos servicios + hooks controladores. Restaura la regla "no Supabase en pages/components".
3. **Refactor `lib/mappers/embarqueFromDb|ToDb` y `cotizacion[Form]`** — partir cada uno en: `parseDb()` (zod) + `mapDbToDomain()` + `applyDefaults()`. Bajar complejidad a <15.
4. **Auditar los 9 `exhaustive-deps` ignorados** — convertir a deps explícitas o documentar el motivo (ref pattern, mount-only).

### P1 — Alto valor estructural (Sprint 2)

5. **Unificar utilidades** — eliminar `src/utils/`, mover a `src/lib/utils/` (con `cn`, `htmlEscape`, etc.) y `src/lib/io/` para descargas/ZIP. Borrar `src/lib/utils.ts` plano.
6. **Romper servicios "god"** — `services/facturas/proyeccion.ts`, `services/cotizacion/mutations.ts`, `services/facturas/huecoFacturacion.ts`: subcarpetas por operación (siguiendo el patrón ya usado en `services/cotizacion/conversiones/`).
7. **Schemas zod para respuestas Supabase críticas** — embarques, facturas, cotizaciones. Reemplazar `fromDb<T>()` por `parse()` validado en frontera.
8. **Tests faltantes en `services/`** — hoy solo 2 suites (`__tests__/idempotency.integration`, etc.). Meta: cobertura mínima por mutación de dominio.

### P2 — Mantenibilidad y DX (Sprint 3)

9. **Resolver 11 `react-refresh/only-export-components`** — separar constantes/helpers de archivos de componente para HMR limpio.
10. **Mover `hooks/use-toast.ts` y `hooks/use-mobile.tsx` a `hooks/shared/`** y reexportar desde el barrel para uniformidad.
11. **Documento `docs/architecture-map.md`** con tabla "dominio → pages → hooks → services → lib" y owners.
12. **Endurecer ESLint progresivamente** — bajar complexity de 15→12 una vez resueltos los top-10; activar `no-restricted-imports` como `error` una vez en cero.

### P3 — Opcional / nice-to-have (Sprint 4)

13. **Subir cobertura E2E** en flujos críticos (Playwright ya tiene 5 specs; sumar conciliación, portal y export ZIP).
14. **Convención de nombres** — algunos hooks usan `useXController` y otros `useXPageController` y otros `useXState`. Documentar y unificar.
15. **Separar `pages/auth/TrackingPublico.tsx`** (complejidad 28) en `TrackingPublicoView` + `useTrackingPublicoController`.
16. **Adoptar `Result<T, E>` o patrón error-typed** en servicios para evitar `throw` ad-hoc.

## 4. Métricas objetivo (post-plan)

| Métrica | Hoy | Objetivo |
|---------|-----|----------|
| Barrel violations | 203 | 0 |
| Complexity warnings | 38 | <5 |
| `exhaustive-deps` ignorados | 9 | 0 |
| `react-refresh` warnings | 11 | 0 |
| Supabase calls desde components/pages | 3 | 0 |
| Tests en `services/` | 2 suites | ≥10 |
| Archivos >250 LOC | 2 | ≤2 |

## 5. Detalles técnicos

- Las migraciones de imports a barrel son mecánicas y se pueden hacer con `jscodeshift` o un script TS con `ts-morph`.
- El refactor de mappers requiere introducir `zod` schemas — ya hay precedente en `lib/csv/importSchemas.ts` y `lib/validation/mutationSchemas.ts`.
- Bajar `max-lines` o `complexity` thresholds debe esperar a Sprint 3 para no inflar el warning count actual.
- Nada de esto requiere migración de base de datos.
