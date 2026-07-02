## Analogía
El CI actúa como un inspector de códigos de construcción: cualquier archivo productivo > 200 líneas es una violación. Dos archivos nuevos rebasaron el límite y todos los shards que corren el test de arquitectura fallan. Solución: subdividir cada archivo en piezas más chicas — como cortar una viga larga en dos vigas soportadas.

## Archivos infractores
- `src/features/costeo/services/tarifas.ts` — 237 líneas
- `src/features/facturacion/components/TabProformasPendientes.tsx` — 214 líneas

## Cambios

### 1. `src/features/costeo/services/tarifas.ts` → dividir por responsabilidad
Crear submódulos y dejar `tarifas.ts` como fachada (re-exports) para no romper imports existentes:

- `src/features/costeo/services/tarifas/queries.ts` → `fetchCosteoTarifas`, `fetchTarifasResumen`, tipos `FetchTarifasFilters`, `TarifaResumen`, mapeadores internos (`mapRow`, `SELECT`).
- `src/features/costeo/services/tarifas/mutations.ts` → `insertTarifaConRecargos`, `updateTarifaConRecargos`, `marcarTarifaReemplazada`, `deleteTarifa`, tipos `TarifaInput`, `TarifaRecargoInput`.
- `src/features/costeo/services/tarifas.ts` → sólo `export * from "./tarifas/queries"; export * from "./tarifas/mutations";`

Todos los consumidores actuales (`import ... from "@/features/costeo/services/tarifas"`) siguen funcionando.

### 2. `src/features/facturacion/components/TabProformasPendientes.tsx` → extraer subcomponentes
- `src/features/facturacion/components/TabProformasPendientesToolbar.tsx` → toolbar (search + filtros + botones con tooltips).
- `src/features/facturacion/components/TabProformasPendientesGrupos.tsx` → render de `renderGrupos()` (lista agrupada por expediente/contenedor).
- `TabProformasPendientes.tsx` queda como orquestador chico (< 60 líneas): llama al hook `useTabProformasPendientesController` y compone `<Toolbar />` + `<Grupos />`.

Sin cambios de comportamiento, mismos props, mismos tooltips.

### 3. Versionado + changelog
- Bump `APP_VERSION` → `13.142.10`.
- Nueva entrada en `CHANGELOG.md`: "Refactor interno: divididos `tarifas.ts` y `TabProformasPendientes.tsx` para cumplir Power of 10 (≤200 líneas). Sin cambios funcionales."

## Fuera de alcance
- No tocar lógica de tarifas ni de proformas.
- No tocar `architecture-baseline` allowlist (queremos que estos archivos queden bajo el umbral, no whitelisteados).
