# Backlog de auditoría — estado al 11.69.0 (cleanslate)

> Baseline definitiva antes de iniciar nuevos módulos. Reporte completo en
> `docs/audit-cleanslate-11.69.0.md`.

## Cerrados

- ✅ **D14** (11.63.0) — Guardrail `oversized > 200`.
- ✅ **C10** (11.63.0) — Inline styles + política `mem://principles/inline-styles`.
- ✅ **D16** (11.64.0) — 0 casts HIGH/CRITICAL productivos (730 total, confirmado en 11.69.0).
- ✅ **D12** (11.65.0) — Split de `routes.tsx`.
- ✅ **P1.5/P1.6** (11.66.0) — `lib/utils/` único; servicios ≤200.
- ✅ **Cleanslate 11.69.0** — Tests 770/770, 0 violaciones bloqueantes.

## Pendientes priorizados

| ID | Tarea | Esfuerzo | Riesgo |
|----|-------|----------|--------|
| **Cx-2** | Reducir CC ≤ 12 en 8 `services/*` + 8 `lib/*` (funciones puras) | M | Bajo |
| Cx-3 | Reducir CC ≤ 12 en 7 hooks + 10 components + 5 pages | L | Medio |
| P1.7+ | Revisar hotspots Zod residuales (caso por caso) | S | Bajo |
| P1-Pag | Auditar 68 hallazgos "query sin paginar" (falsos positivos vs. reales) | S | Bajo |
| Cx-Edge | 4 edge functions con CC > 12 | S | Bajo |
| D13 | Vigilar archivos 180-200 líneas | XS | Nulo |

Cuando Cx-2 + Cx-3 lleguen a 0, bajar `complexity` en `eslint.config.js` de 15 → 12.

## Snapshot 11.69.0

- 1025 archivos TS/TSX (905 productivos).
- 730 casts: 297 SAFE · 12 LOW · 421 MEDIUM (en `lib/mappers/*`) · **0 HIGH / 0 CRITICAL**.
- 38 ofensores CC > 12 (detalle en cleanslate §5).
- 119 test suites / 770 tests / 0 fallos.

## Próximo paso

Iniciar **Cx fase 2** sobre `services/*` y `lib/*` en paralelo con el primer módulo nuevo.
