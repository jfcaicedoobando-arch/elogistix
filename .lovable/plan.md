## Objetivo

Subir la **cobertura de branches** (el cuello de botella) antes que la de statements/lines/functions. Branches mide caminos condicionales (if/else, ternarios, `??`, `||`, switch, early returns), que es donde se esconden los bugs reales.

## Fase 1 — Diagnóstico (sin escribir tests todavía)

1. Generar un reporte de cobertura limpio y completo:
   - `bun run test:coverage` (sin shard, para tener el `coverage-summary.json` consolidado).
2. Construir un ranking de "candidatos de mayor ROI" usando `coverage/coverage-summary.json`, ordenando por:
   - `branches.pct < 50%` **AND** `branches.total >= 10` (archivos con muchas ramas sin cubrir).
   - Priorizar `src/features/{facturacion, cxp, embarques, costeo, proformas}` porque son los módulos pesados recién agregados que están arrastrando el umbral hacia abajo.
3. Producir una tabla corta en `docs/coverage/branch-gaps.md` con: archivo, branches cubiertos/total, % actual, % objetivo, owner del test propuesto.

## Fase 2 — Categorías de código a atacar (en este orden)

Por experiencia en este repo, las ramas no cubiertas se concentran en 4 patrones. Atacarlos en orden maximiza el % por test escrito:

1. **Services / RPC wrappers** (`src/features/*/services/*.ts`)
   - Casi siempre tienen: happy path + `if (error) throw` + validación de `organization_id` + mapeo de filas vacías. 3–4 tests cubren ~90% de branches.
   - Candidatos sospechosos: `facturapi*`, `repFacturapi`, `proveedorNotasCredito`, `notasCredito`, `costosConFactura`, `convertirProformas`.

2. **Hooks de mutación/forms** (`src/features/*/hooks/use*.tsx`)
   - Ramas típicas: estado loading, error de red, validación de campos, callbacks opcionales (`onSuccess?.()`), feature flags.
   - Candidatos: `useEditarFacturaProveedorForm` (ampliar), `useEmitirFactura`, `useCancelarFactura`, `useTimbrarFactura`, `useEmitirRep`.

3. **Utils financieros/parseadores** (`src/features/*/utils/*.ts`, `src/lib/financial/*`)
   - Funciones puras = ROI altísimo en branches por test. Cubrir edge cases: monto 0, divisas mezcladas, redondeos, fechas inválidas.
   - Candidatos: `sumarFacturas`, utilidades de `cfdi`, `traducirErrorPassword`, `pagosProveedorErrors`.

4. **Reducers / state machines** (validaciones de cierre, transiciones de embarque, checklist)
   - Cada transición prohibida es una rama. Tabla parametrizada (`it.each`) cubre muchas branches con poco código.
   - Candidatos: `validar_cierre_embarque` wrapper, `useEmbarqueEstadoActions`, lógica de `Liquidación`.

## Fase 3 — Estrategia de escritura de tests

- **`it.each` para tablas de decisión.** Una sola suite parametrizada cubre 6–12 branches.
- **Mock mínimo.** Reutilizar `_supabaseChainMock.ts`; no inventar mocks nuevos.
- **Cubrir el lado "feo" primero**: errores, nulls, permisos denegados, monedas no soportadas. Los happy paths ya suelen estar cubiertos.
- **Assertions fuertes** (`audit:tests` lo exige): `toEqual` sobre objetos, no `toBeDefined`.
- **No tests cosméticos** (snapshots de JSX sin lógica): no mueven branches y suben el denominador sin beneficio.

## Fase 4 — Meta de cobertura escalonada

En vez de saltar a 70% de una, ratchet en 3 PRs:

| PR  | Branches objetivo | Statements objetivo |
| --- | ----------------- | ------------------- |
| 1   | 45%               | 42%                 |
| 2   | 55%               | 50%                 |
| 3   | 65%               | 60%                 |

Cada PR actualiza el threshold en `vitest.config.ts` **sólo después** de verificar que pasa con margen (≥2pp). Esto evita el patrón de bajar el threshold cuando CI falla (regla `mem://principles/coverage-threshold`).

## Fase 5 — Entregables

1. `docs/coverage/branch-gaps.md` — ranking inicial y reasignaciones por PR.
2. Lotes de tests agrupados por módulo (1 PR ≈ 1 módulo) para revisar fácil.
3. Bump de threshold en cada PR + entrada en `CHANGELOG.md` con versión bumped.

## Notas técnicas

- El reporte actual está fragmentado en `.vitest-reports/blob-*.json`; necesitamos una corrida `test:coverage` consolidada (sin `--shard`) para que `coverage-summary.json` sea fuente de verdad.
- Excluir explícitamente del denominador (en `vitest.config.ts`) cualquier archivo puramente declarativo nuevo (columnas, copy, tipos) que aparezca al revisar el ranking. Esto ya está parcialmente hecho para `marketing/` y `*Columns.tsx`.
- No tocar `src/integrations/supabase/**` ni archivos auto-generados.

## Pregunta de confirmación antes de implementar

¿Avanzo con la **Fase 1 (diagnóstico)** primero y te traigo el ranking real de archivos con baja branch coverage antes de escribir tests? Eso evita gastar tiempo en módulos que ya están razonablemente cubiertos.