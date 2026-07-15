
# Auditoría E2E Playwright — hallazgos y plan de mejora

Analicé `playwright.config.ts`, `globalSetup/Teardown`, las 3 fixtures y los 24 specs (`01`–`24`). Estamos bien arriba del promedio (login persistido, cleanup best-effort, reporte de huérfanos, specs defensivos con `test.skip`), pero hay 6 áreas donde podemos ganar velocidad, estabilidad y cobertura real. Traducción sencilla: hoy los tests son como un vigilante que revisa que las puertas del edificio abran; queremos convertirlo en uno que también compruebe que cada oficina por dentro funcione, y que lo haga en la mitad del tiempo.

## Hallazgos principales

**H1. `workers: 1` + `fullyParallel: false` deja los specs corriendo en fila.** Con 24 specs, cada segundo cuenta. La mayoría de los `13`–`22` son read-only y podrían paralelizarse.

**H2. Todos los specs usan el **mismo** storageState internal.** Un spec mutador (09, 10, 11, 12) que corrompa la sesión afecta a los siguientes. Sin aislamiento por worker.

**H3. Muchos specs se degradan silenciosamente a `test.skip` sin señal.** Si `E2E_HAS_SEED` no está seteado en CI, los 4 nuevos (`21`–`24`) y los avanzados (`07`–`12`) pasan verdes sin ejecutar nada. No hay un "gate" que reporte cobertura efectiva.

**H4. Selectores frágiles por texto en español.** `getByText(/entregad[oa]|arribad[oa]|en dest/i)` en `21`, o `getByRole("button", { name: /recalcular|actualizar/i })` en `24`. Un cambio de copy rompe el test. Faltan `data-testid` estables.

**H5. Cleanup best-effort ≠ cleanup garantizado.** El reporte de huérfanos existe (`globalTeardown.ts`) pero solo cuenta filas con tag `E2E_TEST` en 5 tablas. Faltan `embarques` creados por spec 11 y auditorías del 10 con timestamps de la corrida.

**H6. Duplicación entre specs.** `loginAs` + `goto("/embarques")` + `rows.first()` se repite en 8 specs. No hay Page Objects ni helpers de navegación. Waits arbitrarios (`waitForTimeout(200|1200)`) en 21, 22 y 13.

**H7. Sin trazas Sentry ni logs de consola como aserción global.** Solo `13` chequea `consoleErrors`. Un `TypeError` durante el smoke se ignora en 23 de 24 specs.

**H8. `webServer: bun run dev` en local, pero contra staging no hay health check.** Si el deploy aún no está listo, los specs fallan con timeouts confusos en vez de un mensaje claro.

**H9. No hay reporte JUnit ni integración con CI.** Solo `list` + `html`. GitHub Actions no puede anotar PRs con los fallos.

**H10. Falta accessibility (axe) y visual regression (screenshots snapshot) en los flujos ya cubiertos.** Es low-hanging: `@axe-core/playwright` sobre 4 rutas críticas nos daría regresión de a11y por ~150 líneas.

## Plan de mejora — 6 batches

### Batch A — Aislamiento y paralelismo (rápido, alto impacto)
1. `playwright.config.ts`: subir `workers` a `4` en local y `2` en CI, activar `fullyParallel: true`, y agrupar los specs mutadores (`09`,`10`,`11`,`12`) en un project **`chromium-mutators`** con `fullyParallel: false` para preservar el orden actual.
2. Los specs read-only (`01`–`08`, `13`–`24`) al project **`chromium-internal`** paralelo. Portal sigue en su project.
3. Cada worker recibe su propio `storageState.<workerIndex>.json` (patrón oficial de Playwright): duplicar el login en `globalSetup` en función de `workers`.

### Batch B — Cobertura efectiva y "skip-guard"
1. Nuevo helper `e2e/fixtures/requireSeed.ts` que llama a `test.skip(!process.env.X, msg)` **y** registra el nombre del spec saltado en un archivo `test-results/skipped.json`.
2. `globalTeardown` publica un resumen: total specs / ejecutados / saltados / con seed faltante. Falla si `SKIP_RATIO > 30 %` en CI (env `E2E_MAX_SKIP_RATIO`).
3. Nuevo script `bun run e2e:doctor` que valida que las env vars de `.env.e2e` estén completas y que los UUIDs (`E2E_CROSS_ORG_*`, `E2E_PROVEEDOR_ID`, etc.) existan en la DB con un `HEAD` a `/rest/v1/<tabla>`.

### Batch C — Selectores estables y Page Objects
1. Añadir `data-testid` a los anchor points más frágiles: tabs de embarque (`tab-resumen`, `tab-tracking`, `tab-documentos`), botón "Recalcular" (`auditoria-recalcular-btn`), chip locked de CC (`envio-cc-chip-locked`), columna "Vence en" (`por-cobrar-vence-en-cell`).
2. Crear `e2e/pageObjects/` con 4 POs mínimos: `EmbarquesListPO`, `EmbarqueDetallePO`, `FacturacionPO`, `AuditoriaPO`. Cada uno expone métodos `goto()`, `openFirstRow()`, `openTab(name)`. Refactorizar 21–24 primero.
3. Reemplazar `waitForTimeout(N)` por `expect.poll(...)` o `waitForFunction`.

### Batch D — Robustez de la sesión y cleanup
1. Extraer `fetchWithSupabaseAuth` de `fixtures/api.ts` y **usar el service_role solo desde `globalTeardown`** (no desde specs). Hoy el cleanup del spec 12 depende de que el user internal tenga permisos de DELETE — frágil si RLS cambia.
2. Cada spec mutador registra los IDs creados en `test-results/created-ids.json`. `globalTeardown` hace un barrido final por esos IDs incluso si el `afterAll` del spec falló.
3. Añadir sondas al `PROBES` de `globalTeardown`: `embarques.numero_embarque like 'E2E_TEST%'` y `auditoria_snapshots` de la corrida.

### Batch E — Observabilidad
1. Fixture global que instala un `page.on("pageerror")` y `page.on("console" → error)` que **falla el test** si aparece un error no esperado. Whitelist configurable por spec (`test.info().annotations`).
2. Reporter JUnit + `blob` reporter para poder mergear resultados de shards en CI (`--shard 1/4` en la matrix).
3. Integrar `@axe-core/playwright` con un helper `expectNoA11yViolations(page)` en 4 rutas: `/inicio`, `/embarques`, `/facturacion`, detalle de embarque. Severidad `serious`+`critical` = fail.

### Batch F — DX y CI
1. Workflow `.github/workflows/e2e.yml` con matriz `{ shard: [1,2,3,4] }`, cache de `~/.cache/ms-playwright`, upload de `playwright-report/` y `test-results/` como artefactos.
2. Comando `bun run e2e:ui` (`playwright test --ui`) y `bun run e2e:debug <spec>` documentados en el README.
3. Actualizar `e2e/README.md` con la nueva tabla de projects, la política de `data-testid` y el flujo de shards.

## Detalles técnicos por spec (correcciones puntuales)

- **`22`**: el chip locked se busca por `[data-locked=true]` que no existe en el DOM actual del `EmailChipsField`. Cambiar a `data-testid="envio-cc-chip-locked"` en el componente.
- **`23`**: `rows.locator("td").nth(3)` asume orden de columnas. Añadir `data-testid="col-vence-en"` a la celda y localizar por eso.
- **`24`**: la regex `/recalcular|actualizar/i` matchea también botones de la sidebar. Restringir a `page.getByRole("main")` primero.
- **`21`**: el `arribadoBadge` con regex textual es muy amplio y matchea la palabra "arribo" en el timeline. Buscar `[data-testid="estado-progreso"]` con `data-arrived="true"`.
- **`13`**: reemplazar `waitForTimeout(1200)` por esperar a que la última query de React Query settle (`await page.waitForResponse` del RPC del dashboard).

## Impacto estimado
- Tiempo de corrida local: ~9 min → **~3 min** (paralelismo + shards).
- Cobertura efectiva reportada: hoy opaca → **dashboard de skip/exec por spec**.
- Regresiones de a11y detectables: 0 → **4 rutas críticas**.
- Mantenimiento por cambio de copy: alto → **bajo** (testids).

## Alcance sugerido para la primera implementación
Empezar por **Batch A + Batch C aplicado solo a los specs 21–24 + Batch E punto 1 (page errors globales)**. Es el 20 % que da el 70 % del valor y evita un PR gigante. Los demás batches se abren como tareas de seguimiento.
