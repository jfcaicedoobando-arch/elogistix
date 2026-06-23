
# Plan — Mejora de calidad de tests (3 sprints consolidados)

Ejecuta de raíz los 3 problemas detectados en la auditoría: **patrones sistémicos**, **huecos críticos sin test** y **fragilidad/over-mocking**. Una sola entrega, una sola versión.

## Analogía

Hoy los tests son como una alarma que suena cuando cambias el foco del techo, pero NO suena cuando entra un ladrón. Vamos a invertirlo: que la alarma suene cuando algo importante se rompe y se calle cuando sólo cambias copy.

---

## Sprint 1 — Patrones sistémicos (arreglar de raíz)

### 1.1 Eliminar "tests de grep" en edge functions (5 archivos)
Archivos: `cxc-recordatorios/index_test.ts`, `demo-access/index_test.ts`, y 3 más que sólo hacen `assertStringIncludes(source, "authenticateRequest")`.

Acción: reemplazar por tests que **invocan el handler** con un Request falso y asertan:
- 401 sin Authorization
- 403 si el JWT no tiene el rol esperado
- 200 con payload válido

### 1.2 "Spy sin payload" en mutaciones (≥6 servicios)
Archivos como `embarques/services/mutations.test.ts:150`, `tesoreria/services/conciliacion.test.ts`.

Acción: cambiar `expect(spy).toHaveBeenCalled()` por aserciones de **qué columna y qué valor** se escribió. Helper nuevo `assertUpdatePayload(mock, table, expectedFields)` para no repetir.

### 1.3 Guardrails de arquitectura con exhaustividad
Archivos: `sentry-edge-wrapping.test.ts`, `sentry-edge-coverage.test.ts`, `sentry-imports-guardrail.test.ts`, `safe-casts-services.test.ts`.

Acción: añadir un test que escanea `supabase/functions/*/index.ts` y verifica que **toda función** está en una de las dos listas (wrap o manual). Hoy una función nueva pasa invisible.

### 1.4 Tests de transiciones inválidas (estados)
Archivos: `cotizacion/services/mutations/estado.test.ts` documenta que "acepta cualquier estado" — eso es un bug, no un feature.

Acción: añadir guard en el servicio + test que asegure que transiciones imposibles (`Cerrada → Borrador`, `Pagada → Pendiente`, etc.) **lanzan**. Aplica a cotización (5 estados) y embarques (7 estados).

---

## Sprint 2 — Huecos críticos sin test (los que duelen en producción)

### 2.1 Acceso anónimo con SERVICE_ROLE
Test: para cada edge function que usa `SUPABASE_SERVICE_ROLE_KEY`, un test que llama sin Authorization y espera 401.

### 2.2 División por cero / arrays vacíos
Archivo: `embarques/services/pnlPorContenedor.ts`.
Test: contenedor vacío, contenedor con cero TEUs, montos en 0 → no NaN, no Infinity.

### 2.3 Modos no marítimos (Aéreo, Terrestre)
Hoy los tests asumen marítimo. Añadir casos para los otros 2 modos en funciones de embarque, tracking y cálculo de demoras.

### 2.4 Precisión decimal en comisiones y fees
Extender el modelo de `financialUtils.edge.test.ts` a `comisiones/services/devengadas.ts` y `cxp/services/*`.

### 2.5 Helper de fake timers
Reemplazar `new Date()` por `vi.useFakeTimers()` + fecha fija en `devengadas.test.ts` y otros 4 archivos con dependencia de tiempo real (flaky a las 23:59).

---

## Sprint 3 — Fragilidad y over-mocking

### 3.1 Quitar mocks de pura lógica
Archivo prototipo: `useAdminOrgConfig.test.tsx` mockea `agruparConfigPorCategoria` (función pura). Acción: ejecutarla de verdad.

### 3.2 Reemplazar copy literal en español
Reemplazar `getByText('Guardar cambios')` por `getByRole('button', { name: /guardar/i })` o `data-testid`. Aplicar en los 10 archivos con más copy literal.

### 3.3 Tests que asertan lo que el mock devuelve
Marcar y eliminar tests donde `mock.returns(X); expect(result).toBe(X)` — son tautologías.

---

## Validación

Después de cada sprint:
- `bun run test` (suite completa verde)
- `bun run audit:tests` (higiene en 0)
- Inyectar 1 bug intencional en `pnlPorContenedor` y verificar que un test del Sprint 2 lo caza (prueba de "mutation testing" manual).

## Versionado y changelog

- `APP_VERSION` → `13.115.0` (minor, no patch — es un refactor grande de tests)
- `CHANGELOG.md` → entrada única `## [13.115.0]` con las 3 secciones (Sistémicos, Huecos, Fragilidad)
- `.lovable/plan.md` se actualiza con avance

## Fuera de scope

- Cobertura de líneas/branches
- Tests E2E nuevos (los `e2e/specs/*` ya existentes no se tocan)
- Refactor de `_supabaseChainMock` (ya tiene memoria propia)

## Estimación

~25-35 archivos tocados, ~80-120 assertions nuevas o reescritas, ~15-20 tests eliminados por redundantes. Suite final más pequeña pero con **mucha más señal**.

¿Apruebas para implementar todo en una sola entrega?
