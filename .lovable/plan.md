# Plan: Quick Wins de Tests + Ratchet 35% + Gaps de Cobertura

Versión objetivo: `13.85.7` → `13.86.0` (incrementos por entrega).
Cada entrega = 1 bump `APP_VERSION` + 1 entrada `CHANGELOG.md` (root).

---

## Parte A — Quick Wins (6)

### QW1 · Test vacío que pasa silenciosamente (5 min)
- Archivo: `src/__tests__/architecture/fase2-pages-and-formatters.test.ts:19`
- Acción: añadir `expect(...)` real (verificar que los formatters listados existen y exportan función), o eliminar el `it()` si la regla ya está cubierta por `fase4-naming-camelcase`.
- Riesgo: ninguno; sólo cierra un falso verde.

### QW2 · Títulos duplicados de `it(...)` (10 min)
- Archivos:
  - `src/features/embarques/hooks/mutations/__tests__/mutations.test.ts` (3 duplicados)
  - `src/lib/formatters/__tests__/*.test.ts` (~14 duplicados)
- Acción: renombrar añadiendo contexto (`"formatea cero" → "formatCurrency formatea cero"`). No alterar lógica.
- Verificación: `bun run audit:tests` debe quedar en 0.

### QW3 · Migrar 7 mocks manuales de Supabase a `createSupabaseMock` (~1 h)
- Subagente: explorar y listar los 7 archivos con mocks ad-hoc bajo `src/**/__tests__/**` y `src/services/**/__tests__/**`.
- Acción: reemplazar por el helper canónico `@/services/__tests__/_supabaseChainMock` (cadena thenable, ya estandarizado por memoria `mem://technical/testing-mock-patterns`).
- Riesgo: cambios mecánicos; correr suite tras cada archivo.

### QW4 · Timers sin cleanup en 9 archivos (~1 h)
- Subagente: localizar los 9 tests con `setTimeout`/`setInterval` sin `vi.useFakeTimers()` + `vi.useRealTimers()` en `afterEach`.
- Acción: envolver con fake timers, o añadir `clearTimeout/clearInterval` en cleanup. Respetar `mem://technical/testing-cleanup-protocol`.
- Verificación: leak canary (`pdfLeak.test.tsx`) sigue verde.

### QW5 · Ratchet de cobertura a **35%** (5 min)
- Archivo: `vitest.config.ts`
- Acción: subir thresholds:
  ```ts
  thresholds: { lines: 35, statements: 35, functions: 48, branches: 67 }
  ```
- Nota: cobertura actual líneas = 29.0%. **El umbral 35% fallará la suite hoy.** Se aplica DESPUÉS de QW6 (al elevar cobertura) para no romper CI. Orden definido en sección C.

### QW6 · Unit tests para los 3 hooks más grandes sin cobertura (~3-4 h)
- `src/hooks/cxp/useNuevaFacturaProveedorForm.ts` (194 líneas, 0%)
- `src/features/cxp/hooks/useNuevoProveedorController.ts` (191, 0%)
- `src/features/embarques/hooks/useNuevoEmbarqueWizard.ts` (187, 0%)
- Patrón: `renderHook` + `createSupabaseMock` + casos felices/error/validación.
- Meta por hook: ≥70% líneas → suma ~+1.1% cobertura global cada uno.

---

## Parte B — Cierre de Gaps de Cobertura (para sostener ratchet 35%)

Tras QW6 quedaremos en ~32%. Para llegar y sostener 35% sin sufrir cada migración, se agrega:

### B1 · Top 10 archivos 0% de alto impacto (subagente paralelo)
Priorizar por líneas × frecuencia de cambio (del reporte):
1. `src/hooks/cxp/useNuevaFacturaProveedorForm.ts` (cubierto en QW6)
2. `src/features/embarques/hooks/useEmbarquesPageState.ts` (126)
3. `src/components/cxp/DialogRegistrarPagoProveedor.tsx` → extraer hook puro y testearlo
4. `src/features/embarques/components/tracking/TrackingNuevoEventoForm.tsx` → hook de validación
5. `src/features/auditoria/components/HallazgosTabla.tsx` → helpers de filtros

Excluimos páginas puras (`Login.tsx`, `Dashboard.tsx`, `Clientes.tsx`, `ClienteDetalle.tsx`, `Bitacora.tsx`, `Papelera.tsx`, `Idempotencia.tsx`, `Oportunidades.tsx`) — son JSX declarativo, mejor cubrir vía E2E (fuera de alcance de este plan).

### B2 · Excluir más ruido del denominador
Añadir a `coverage.exclude` en `vitest.config.ts`:
- `src/pages/**/*.tsx` que sólo orquestan layout (verificar caso por caso, máx 5 archivos)
- `src/components/**/*Dialog.tsx` que son sólo presentación sin lógica
Trade-off: menos denominador → más % real. Documentar criterio en comentario.

### B3 · Subir `functions` a 50 y `branches` a 68
Ya estamos en 46.8/67.7. Tras QW6+B1 quedaremos sobre 50/68. Subir como ratchet defensivo.

---

## Parte C — Orden de Ejecución (importante)

1. **QW1 + QW2** (paralelo, <15 min) → bump `13.85.7`
2. **QW3 + QW4** (subagentes paralelos, ~1 h) → bump `13.85.8`
3. **QW6** (3 hooks, subagentes paralelos) → bump `13.85.9`, mide cobertura
4. **B1 + B2** (subagentes paralelos) → bump `13.85.10`, mide cobertura
5. Solo cuando coverage real ≥ 36% (1% de margen):
   **QW5 + B3** → ratchet a `lines/statements: 35, functions: 50, branches: 68` → bump `13.86.0`
6. Correr suite completa final + `audit:tests` + `coverage-report`.

**Política del ratchet 35%**: si tras un PR la cobertura baja de 35%, CI debe fallar. El umbral se mantiene fijo en 35% (no se baja nunca). Subir sólo cuando coverage real ≥ umbral+2%.

---

## Verificación final
- `bunx vitest run` → 3354+ tests, 0 fallos
- `bun run audit:tests` → 0 violaciones
- `bun run coverage-report` → líneas ≥ 36%
- `vitest.config.ts` → thresholds {35, 35, 50, 68}
- `CHANGELOG.md` → entradas por cada bump
- `APP_VERSION` → `13.86.0`

## Detalles técnicos
- Subagentes: usar `acp_subagent--spawn_agent` en paralelo para QW3, QW4, QW6 (3 hooks), B1 (5 archivos). Total: ~10 subagentes simultáneos en 2 olas.
- Reglas a respetar: `mem://principles/power-of-10`, `mem://technical/testing-mock-patterns`, `mem://technical/testing-cleanup-protocol`, `mem://instructions/changelog-updates`.
- No tocar: `src/integrations/supabase/**`, `.env`, `supabase/config.toml`.
