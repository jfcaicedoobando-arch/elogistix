# Backlog de auditoría — estado al 11.67.0

## Cerrados

- ✅ **D14** (11.63.0) — Guardrail `oversized > 200` en `architecture-baseline.test.ts`.
- ✅ **C10** (11.63.0) — Quick wins inline styles + política en `mem://principles/inline-styles`.
- ✅ **D16** (11.64.0) — 0 casts HIGH/CRITICAL productivos. Clasificador + guardrail.
- ✅ **D12** (11.65.0) — Split de `routes.tsx` en 4 grupos por guarda+layout (188→19 líneas).
- ✅ **P1.5** (11.66.0) — Ya satisfecha: solo existe `src/lib/utils/` con barrel.
- ✅ **P1.6** (11.66.0) — Ya satisfecha: ningún servicio supera 200 líneas.

## Pendientes

| ID | Tarea | Esfuerzo | Riesgo |
|----|-------|----------|--------|
| D13 | Vigilar archivos 180-200 líneas (preventivo, continuo) | XS | Nulo |
| P1.7* | Extender Zod a boundaries restantes (6 hotspots cubiertos en 11.66 + 11.67) | S | Bajo |
| Cx | Bajar complejidad 13 funciones src/ + 4 edge functions a ≤12 | M | Medio |

## P1.7 — Estado parcial

Cubiertos en 11.66.0:
- `lib/parsers/dashboard.ts` (peso 14) → `dashboardSchemas.ts`
- `lib/mappers/embarqueToDb.ts` (peso 12) → `embarquePayloadSchemas.ts`
- `services/embarque/queries/exportListado.ts` (peso 10) → `embarqueRowSchema.ts`

Cubiertos en 11.67.0:
- `components/admin/TabSeguridadGlobal.tsx` (peso 12) → `hooks/configuracion/configSchemas.ts`
- `services/embarque/documentos.ts` (peso 12) → `services/embarque/idempotencyClaimSchema.ts`
- `components/auditoria/HallazgosFiltros.tsx` (peso 10) → `components/auditoria/hallazgosFiltrosSchemas.ts`

Descartados (no son boundary real):
- `lib/audit/diffFields.ts` (peso 12) — genericidad estructural, Zod no aplica sin reescribir API.

Pendientes (peso ≤ 10, orden sugerido):
- `hooks/embarque/useProformas.ts` (peso 10) — revisar si hay boundary real o sólo aliases.
- Resto del backlog según prioridad.

## Próximo paso

**Cx** (complejidad) o continuar P1.7 sobre los hotspots restantes.
