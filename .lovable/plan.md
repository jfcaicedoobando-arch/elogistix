# Auditoría Arquitectónica — v12.95.2

Baseline general: **muy saludable**. El proyecto ya tiene un pipeline de auditoría continuo (`bun run audit:all`) con reglas Power-of-10 y tests de arquitectura. La mayoría de capas están limpias. Los hallazgos son acotados y priorizables.

## Resumen ejecutivo

| Área | Estado | Detalle |
|---|---|---|
| Capa Pages→Hooks→Services→Lib | ✅ | 0 imports directos a `@/integrations/supabase/client` desde hooks/components/pages |
| Power-of-10 (>200 líneas) | ⚠️ | 17 archivos productivos exceden el límite |
| Casts riesgosos | ✅ | 1 HIGH, 0 CRITICAL sobre 1358 casts |
| Higiene de tests | ⚠️ | 3 títulos duplicados |
| Organización por dominio | ⚠️ | Convivencia de dos patrones: `src/features/*` (folder-style) y `src/{components,hooks,services,pages}/<dominio>` (layer-first) |
| Separación de concerns | ✅ | Servicios desacoplados, hooks orquestan, componentes presentacionales |

## Hallazgos principales

### 1. Inconsistencia estructural (modular vs por capa) — ALTA
Solo 3 dominios (`auditoria`, `costeo`, `embarques`) viven en `src/features/<dominio>/{domain,services,hooks,components,routes,types}`. El resto (proveedor, cliente, cotizacion, facturas, cxp, crm, tesoreria, profit, presupuesto, comisiones, portal, etc.) está disperso en `src/components/<dominio>`, `src/hooks/<dominio>`, `src/services/<dominio>` y `src/pages/<dominio>`. Esto:
- Obliga a saltar entre 4 árboles para entender un dominio.
- Fragmenta la propiedad y dificulta refactors transversales.
- Reduce el beneficio del barrel `index.ts` ya adoptado en `features/*`.

### 2. Archivos > 200 líneas (Power-of-10) — ALTA
17 archivos rompen el límite. Top 5:
- `components/proveedor/NuevoProveedorDialog.tsx` (325) — mezcla wizard + validación + IO.
- `pages/proveedores/ProveedorDetalle.tsx` (293) — tabs + queries + acciones.
- `hooks/cxp/useNuevaFacturaProveedorForm.ts` (266) — RHF + cálculos + side-effects.
- `features/costeo/components/TarifaForm.tsx` (261).
- `features/embarques/components/StepCostosPrecios.tsx` (247).

### 3. Cast HIGH único — MEDIA
`src/services/embarques/reconciliacionCostos.ts:125`:
```ts
const conceptos = (cc ?? []) as unknown as CCRow[];
```
Doble cast sobre respuesta Supabase sin parseo.

### 4. Hygiene de tests — BAJA
3 títulos duplicados (cliente/embarques, facturas/cobranza).

### 5. UI distribuida en dos árboles — MEDIA
Coexisten `src/components/<dominio>/` y `src/pages/<dominio>/` para el mismo dominio (ej. `proveedor` tiene componentes en `components/proveedor` y rutas en `pages/proveedores`). Refuerza el #1.

### 6. God components / controllers gordos — MEDIA
`useNuevoProveedorController.ts` (246) y `useNuevaFacturaProveedorForm.ts` (266) acumulan estado RHF + cálculos derivados + submission + side-effects. Idealmente: hook de estado + hook de mutación + utilidades puras en `lib/`.

## Plan de mejora (orden de prioridad)

```text
CRÍTICO  →  Paso 1, 2
ALTO     →  Paso 3, 4
MEDIO    →  Paso 5, 6
OPCIONAL →  Paso 7, 8, 9
```

### Paso 1 — Resolver el cast HIGH (esfuerzo: bajo)
Reemplazar el `as unknown as CCRow[]` en `services/embarques/reconciliacionCostos.ts:125` por un type guard o `zod`/`fromDb` ya usado en el proyecto. Deja la auditoría 100% verde.

### Paso 2 — Bajar todos los archivos productivos a ≤200 líneas (esfuerzo: medio)
Una PR por archivo, extrayendo:
- Sub-componentes a `<dominio>/<Componente>/<Subparte>.tsx`.
- Lógica de validación/cálculos a `lib/` o `domain/`.
- Mutaciones React Query a hooks dedicados.
Empezar por los 5 top y avanzar hasta vaciar la lista de 17.

### Paso 3 — Adoptar `src/features/<dominio>/` como estructura única (esfuerzo: alto, iterativo)
Migrar dominios uno a uno desde `{components,hooks,services,pages}/<dominio>` a `features/<dominio>/{domain,services,hooks,components,routes,types,index.ts}`. Orden sugerido por volumen y acoplamiento:
1. `proveedor` (más oversized hits).
2. `cxp`.
3. `cotizacion`.
4. `facturas`.
5. `cliente`.
6. `crm`.
7. `tesoreria`, `profit`, `presupuesto`, `comisiones`, `portal` (más pequeños, último).

Cada migración: mover archivos, actualizar imports, conservar barrel `index.ts`, mantener el test de arquitectura verde.

### Paso 4 — Endurecer ESLint y tests de arquitectura (esfuerzo: bajo)
Añadir a `src/lib/__tests__/architecture.test.ts`:
- Regla: no se permite crear nuevas carpetas en `src/{components,hooks,services,pages}/<dominio>` si ya existe `src/features/<dominio>/` (forzar la migración).
- Regla: archivos productivos > 200 líneas → falla el test (hoy solo lo reporta el script).
- Regla: prohibir `as unknown as` fuera de `lib/mappers/*` y tests.

### Paso 5 — Resolver duplicate-title en tests (esfuerzo: trivial)
Renombrar los 3 `it`/`describe` reportados o agregarlos al allowlist con justificación.

### Paso 6 — Descomponer "god controllers" (esfuerzo: medio)
Para `useNuevoProveedorController`, `useNuevaFacturaProveedorForm` y similares:
- `useXxxFormState` → solo RHF + defaults.
- `useXxxDerived` → cálculos memoizados puros (testeable sin RHF).
- `useXxxMutations` → React Query.
- `useXxx` (orquestador) → compone los anteriores, debe quedar ≤80 líneas.

### Paso 7 — Documentación de capas (esfuerzo: bajo)
Un único `docs/architecture.md` que dibuje `Pages → Hooks → Services → Lib`, defina la estructura `features/<dominio>/` como canónica y prohíba shortcuts. Hoy esto vive disperso entre memorias y comentarios.

### Paso 8 — Consolidar `src/components/ui` vs componentes de dominio (esfuerzo: bajo)
Verificar que `src/components/ui/` solo contenga shadcn/primitivas. Mover cualquier componente con lógica de dominio al feature correspondiente.

### Paso 9 — Auditoría continua en CI (esfuerzo: trivial)
Agregar `bun run audit:all` como job obligatorio en GitHub Actions (hoy existe localmente y en lefthook; falta gating en CI según `package.json`).

## Detalle técnico

- **Script de referencia**: `scripts/audit-architecture.ts` ya enumera oversized + imports directos. La extensión sugerida en Paso 4 es agregar un `expect(oversized).toEqual([])` en el test de arquitectura.
- **Reglas memoria aplicables**: `mem://principles/power-of-10`, `mem://technical/architecture-and-standards`, `mem://audit/pendings`.
- **No tocar**: `src/integrations/supabase/{client,types}.ts`, `supabase/config.toml`, `src/components/ui/sidebar.tsx` (exento).
- **Bump de versión**: cada paso completado actualiza `CHANGELOG.md` y `APP_VERSION` (regla del proyecto).

## Fuera de alcance

- Cambios funcionales o de negocio.
- Refactor de PDF, RLS o auth (otras auditorías).
- Migrar tests existentes (solo renombrar duplicados).
