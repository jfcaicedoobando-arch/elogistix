## Objetivo

Sincronizar los MDs de auditoría con el estado real de 11.68.0 y ejecutar una **auditoría desde cero** (cleanslate) que sirva de baseline definitivo antes de empezar nuevos módulos.

## Fase 1 — Actualizar archivos MD

Refrescar a la versión 11.68.0:

1. `docs/power10-baseline.md` — regenerar contadores (archivos >200, `any`, useEffect sin cleanup, queries sin paginar) con datos actuales.
2. `docs/cast-audit.md` — regenerar vía `bun scripts/audit-casts.ts` (refleja el estado tras P1.7).
3. `docs/auditoria.md` — actualizar fecha/versión de revisión y referenciar cierres de D12/D14/D16/P1.5/P1.6 + parciales P1.7 y Cx.
4. `docs/tests-audit.md` — regenerar conteo de suites/tests (770 actualmente).
5. `docs/architecture-map.md` — verificar que los renombres (`lib/parsers`, `lib/mappers`, schemas Zod nuevos, helpers NBA, etc.) estén reflejados.
6. `.lovable/plan.md` — marcar entrada de auditoría cleanslate como "en curso" y consolidar pendientes.

## Fase 2 — Auditoría cleanslate

Ejecutar en orden, recolectando outputs:

1. **Casts** — `bun scripts/audit-casts.ts` → confirmar 0 HIGH/CRITICAL productivos (guardrail D16).
2. **Power of 10** — `bun scripts/audit-power10.ts` → archivos >200, `any`, effects sin cleanup, queries sin paginar.
3. **Tests** — `bun scripts/audit-tests.ts` + `bunx vitest run` → suite completa verde y conteo actualizado.
4. **Arquitectura** — `bun scripts/audit-architecture.ts` → guardrails (oversized, capas, etc.).
5. **Complejidad** — `bunx eslint 'src/**/*.{ts,tsx}' --rule '{complexity: ["error", 12]}' --no-eslintrc -c eslint.config.js` para listar ofensores restantes (CC>12).
6. **Build/typecheck** — confirmado automáticamente por el harness.
7. **Reporte agregado** — `bun scripts/audit-report.ts` si aplica, o consolidar manualmente en una sección nueva.

## Fase 3 — Reporte consolidado

Crear `docs/audit-cleanslate-11.69.0.md` con:

- Snapshot por categoría (Power10, casts, tests, complejidad, arquitectura).
- Tabla de pendientes restantes con prioridad sugerida (Cx fase 2, P1.7 hotspots residuales, edge functions CC>12).
- Recomendación: qué cerrar antes de tocar módulos nuevos vs qué puede esperar.
- Riesgos detectados (si surgen durante el cleanslate).

## Versionado

- `APP_VERSION` → `11.69.0` (minor: refleja cierre de auditoría + nueva baseline).
- Entrada en `CHANGELOG.md` raíz y en `src/pages/Changelog.tsx`.

## Fuera de alcance

- No se refactoriza código en este loop. Solo documentación + ejecución de auditoría.
- Edge functions con CC>12 quedan listadas, no tocadas.
- Bajar umbral ESLint de 15→12 espera a Cx fase 2.

## Entregables

1. 5-6 MDs de auditoría actualizados.
2. `docs/audit-cleanslate-11.69.0.md` nuevo.
3. `.lovable/plan.md`, `CHANGELOG.md`, `appVersion.ts`, `Changelog.tsx` actualizados.
4. Confirmación de que toda la suite (770+ tests) sigue verde.
