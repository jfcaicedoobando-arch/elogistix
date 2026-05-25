# Auditoría arquitectónica — Reporte (lectura)

## TL;DR

La arquitectura está **muy sana**. Las grandes batallas (capas, barrels, Power of 10, `any`, complejidad, perf tests) ya están ganadas. Lo que queda son **refactors quirúrgicos** y **endurecimientos** del linter/tests, no rescates de deuda crítica.

## Métricas actuales (medidas, no estimadas)

| Métrica | Valor | Estado |
|---|---|---|
| Archivos `> 200` LOC (excluyendo generados/changelog/sidebar shadcn) | **0** | ✅ |
| `any` en `src/` | **0** | ✅ |
| `console.log/error/warn` (uso de `logger`) | **0** | ✅ |
| TODO / FIXME / HACK | **0** | ✅ |
| `supabase.from(...)` en pages/components | **0** | ✅ |
| Imports `from '@/services/*'` en pages/components | **0** | ✅ |
| Barrels de dominio | **38** | ✅ |
| `eslint-disable` restantes | **33** | ⚠️ revisar |
| `queryKey: [...]` inline fuera de `lib/query` | **110** | ⚠️ centralizar |
| Archivos en `src/` | 930 (202 hooks · 347 components · 59 pages) | ✅ granular |

Archivos legítimamente grandes (no son violación):
- `integrations/supabase/types.ts` (3567) — generado
- `content/changelog/**` — datos
- `components/ui/sidebar.tsx` (637) — shadcn vendored

## Hallazgos por categoría

### 1. Separación de capas (pages → hooks → services → lib) — ✅ Excelente
- 0 fugas de Supabase a UI.
- 0 imports de `services/*` desde pages/components.
- Pages típicas (Cotizaciones, Embarques, Clientes…) ≤ 200 LOC y son compositores delgados sobre controllers.
- Mappers e I/O están bien aislados en `lib/mappers/` y `services/<dominio>/`.

### 2. Modularidad por dominio — ✅ Sólida
- `hooks/<dominio>/index.ts` + sub-módulos (`queries`, `mutations`, `bulk`, `convertir`) es el patrón consistente: `embarque`, `cotizacion`, `crm/leads`, `auditoria/revisiones`, `admin`, etc.
- Barrels reales (sólo re-export), sin lógica oculta.

### 3. Acoplamientos / olores remanentes — ⚠️ Menor
- **Query keys dispersas**: 110 `queryKey:[...]` literales fuera de `lib/query/index.ts`. Riesgo de invalidaciones desincronizadas.
- **`eslint-disable` (33)**: la mayoría justificadas (re-exports estables, deps de hooks), pero conviene auditar 1×1 que ninguna esconda un bug latente.
- **`localStorage` directo en 6 archivos** (`ThemeContext`, `OrganizationContext`, `useLoginAudit`, `ErrorBoundary`, `main.tsx`). Funciona, pero un wrapper tipado en `lib/storage` evitaría typos de claves y facilitaría tests/SSR.
- **`services/*` con pocos tests** (~2 suites): la red de seguridad vive casi toda en `lib/` y hooks.

### 4. Pendientes formales heredados (`mem://audit/pendings`)
Quedan abiertos los items: **P1.5 → P2.12** (P0.x todos ✅).

---

## Plan recomendado — ordenado de mayor a menor impacto

### 🔴 Crítico (1)

**1. P1.6 — Romper los "god services" (≤ 200 LOC + complexity ≤ 12)**
Targets: `services/facturas/proyeccion.ts`, `services/cotizacion/mutations.ts`, `services/facturas/huecoFacturacion.ts`.
Estrategia: subcarpeta por operación + barrel (mismo patrón que `services/embarque/`). Mantiene API pública.

### 🟠 Alto (2-4)

**2. Centralizar query keys (110 → 0 fuera de `lib/query`)**
Mover todas las `queryKey: [...]` literales a fábricas en `lib/query/index.ts` (`queryKeys.<dominio>.<recurso>(...args)`). Beneficio: invalidaciones consistentes y refactors guiados por el compilador.

**3. P1.7 — Schemas zod para respuestas Supabase críticas**
Reemplazar `fromDb<T>()` por `parse()` en: `embarques`, `facturas`, `cotizaciones`, `clientes`. Convierte errores de forma en errores de borde en lugar de crashes en UI.

**4. P1.8 — Subir cobertura de `services/` a ≥ 10 suites**
Hoy ~2. Priorizar: `services/facturas/*`, `services/embarque/mutations`, `services/cotizacion/mutations`. Tests de contrato con mock del cliente Supabase.

### 🟡 Medio (5-7)

**5. P2.12 — Endurecer ESLint**
- `complexity` 15 → **12** (ya 0 warnings hoy, listo para bajarlo).
- `no-restricted-imports` `warn` → **error** (barrels ya en 0).
- Auditar y eliminar `eslint-disable` redundantes (~10 candidatos).

**6. Wrapper tipado de `localStorage`**
`lib/storage/keys.ts` con namespace + parse seguro. Migrar los 6 consumidores.

**7. P1.5 — Unificar utils**
Consolidar `src/utils/` + `src/lib/utils.ts` + `src/lib/utils/` en un único `lib/utils/` (+ `lib/io/`).

### 🟢 Opcional (8-11)

**8. P2.9 — Resolver últimos `react-refresh/only-export-components`** (HMR DX).
**9. P2.10 — Mover `hooks/use-toast.ts` y `use-mobile.tsx` a `hooks/shared/`** cuando se refactorice sidebar.
**10. P2.11 — Generar `docs/architecture-map.md` automatizado** (tabla dominio → pages → hooks → services → lib).
**11. P3.13-16 — Más E2E (conciliación, portal, export ZIP); patrón `Result<T,E>` en services**.

---

## Riesgos / cosas que NO hace falta tocar

- `src/components/ui/*` (shadcn vendored) — no refactorizar.
- `src/integrations/supabase/types.ts` — auto-generado.
- `src/content/changelog/**` — datos cronológicos, ya particionados.
- RLS / edge functions — fuera del alcance de auditoría de frontend.

## Verificación sugerida después de cada paso

1. `bunx vitest run` (626 tests verdes).
2. `bunx eslint src` (0 errors, 0 warnings).
3. `bunx tsc --noEmit` (sin errores).
4. Smoke manual: Login → Embarques → Cotización → Factura → CRM.

---

**Siguiente paso sugerido**: arrancar con **P1.6** (god services) porque es el último foco de complejidad ciclomática alta y desbloquea bajar el umbral de ESLint a 12 en el paso 5.