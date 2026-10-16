# Demo interna de dependencias

Vista local pequeña con el hook de rescate, Radix Dialog, Router, QueryClient,
bootstrap de persistencia y useExchangeRates reales. Sigue el aislamiento de los
fixtures vecinos: entrada independiente, envDir vacío, sin public/, Auth,
Supabase ni Sentry; servicios y storage sintéticos en memoria. El build rechaza
imports de backend y la prueba bloquea tráfico externo y WebSockets.
No agrega dependencias ni workflows.

```bash
node node_modules/@playwright/test/cli.js test --config e2e/visual/dependency-audit/playwright.config.ts
# Para revisar la vista manualmente en localhost:8099:
node node_modules/vite/bin/vite.js preview --config e2e/visual/dependency-audit/vite.config.ts
```

Requiere Chromium headless de la versión instalada de Playwright. Los cuatro
casos cubren 1280×720 y 691×763, claro/oscuro, cierre/reapertura/Escape/foco,
navegación, refetch de tasa sintética vencida y exclusión de datos operativos.
Los tests del hook en `src/hooks/shared/__tests__` inyectan además el bloqueo
huérfano para demostrar deduplicación y ausencia de escrituras tras desmontaje.
Los tests de Query usan TanStack real, reloj controlado y storage sintético.

Resultados del navegador y screenshots: `reports/dependency-audit/browser.json`
y `test-results/dependency-audit/` (salidas locales ignoradas por Git).

El job `dependency-audit` del workflow existente `isolated-ui-audit.yml`
ejecuta sólo `specs/demo.spec.ts` en cada PR afectado. Playwright exige un build
fresco antes del preview y no reutiliza servidores. El guard exige exactamente
cuatro casos aprobados, cero fallos, skips, flaky y errores globales; el reporte
faltante o inválido también falla. Los logs, resultados y screenshots sintéticos
se adjuntan como `isolated-ui-dependency-audit`, con retención de tres días.

Pruebas focales sin cargar `.env` (el config reutiliza proyectos/setup/aliases
del repositorio; en Windows, si Vite falla con ENOENT temporal, fijar TEMP/TMP
a un directorio escribible de este checkout):

```bash
node node_modules/vitest/vitest.mjs run --config e2e/visual/dependency-audit/vitest.config.ts --maxWorkers=1 src/hooks/shared/__tests__/useRadixPointerEventsRescue.test.tsx src/hooks/shared/__tests__/useRadixPointerEventsRescue.integration.test.tsx src/lib/query/__tests__/queryClient.test.ts src/lib/query/__tests__/persistBootstrap.test.ts src/__tests__/catalogs/catalogPersistence.test.tsx src/features/catalogos/hooks/__tests__/useExchangeRates.test.tsx
```

Validación local sobre base `9b5bc7d9`: 44 pruebas focales, lint y typecheck globales,
build de la demo y 4 casos Chromium aprobados. Control negativo restaurando
código anterior: 4 regresiones Radix y 9 de Query (más rechazo de restore no
manejado); al quitar sólo la exclusión de mutaciones, el snapshot guarda
variables operativas y falla la aserción. Todo candidato fue restaurado antes
de la pasada positiva final.

Entorno local: Windows, Node 24.19.0 y Bun 1.4.0; instalación congelada sin
scripts. CI usa Node 24.22.0 y debe aportar su propia evidencia. No se ejecutaron
la suite completa, build de la aplicación, DB/RLS ni E2E con servicios reales.
El workaround conserva selector y observación de atributos de body previos.
