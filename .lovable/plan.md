# Backlog de auditoría — estado al 11.65.0

## Cerrados

- ✅ **D14** (11.63.0) — Guardrail `oversized > 200` en `architecture-baseline.test.ts`.
- ✅ **C10** (11.63.0) — Quick wins inline styles + política en `mem://principles/inline-styles`.
- ✅ **D16** (11.64.0) — 0 casts HIGH/CRITICAL productivos. Clasificador + guardrail.
- ✅ **D12** (11.65.0) — Split de `routes.tsx` en 4 grupos por guarda+layout (188→19 líneas).

## Pendientes

| ID | Tarea | Esfuerzo | Riesgo |
|----|-------|----------|--------|
| D13 | Vigilar archivos 180-200 líneas (preventivo, continuo) | XS | Nulo |
| P1.5 | Unificar `utils/` + `lib/utils.ts` + `lib/utils/` | M | Medio |
| P1.6 | Romper servicios "god" (facturas/proyeccion, cotizacion/mutations, huecoFacturacion) | L | Alto |
| P1.7 | Schemas Zod en boundary Supabase (embarques/facturas/cotizaciones) | L | Medio |
| Cx | Bajar complejidad 13 funciones src/ + 4 edge functions a ≤12 | M | Medio |

## Próximo paso

**Fase 3 — P1.5** (unificar `utils/` + `lib/utils.ts` + `lib/utils/` en `lib/utils/` + `lib/io/`). Es prerequisito real para P1.6 (romper servicios god).
