# Backlog de auditoría — estado al 11.66.0

## Cerrados

- ✅ **D14** (11.63.0) — Guardrail `oversized > 200` en `architecture-baseline.test.ts`.
- ✅ **C10** (11.63.0) — Quick wins inline styles + política en `mem://principles/inline-styles`.
- ✅ **D16** (11.64.0) — 0 casts HIGH/CRITICAL productivos. Clasificador + guardrail.
- ✅ **D12** (11.65.0) — Split de `routes.tsx` en 4 grupos por guarda+layout (188→19 líneas).
- ✅ **P1.5** (11.66.0) — Ya satisfecha en el árbol actual: solo existe `src/lib/utils/` con barrel; resto de utilidades segregadas por dominio.
- ✅ **P1.6** (11.66.0) — Ya satisfecha: ningún servicio supera 200 líneas; los "god services" citados ya son carpetas modulares.

## Pendientes

| ID | Tarea | Esfuerzo | Riesgo |
|----|-------|----------|--------|
| D13 | Vigilar archivos 180-200 líneas (preventivo, continuo) | XS | Nulo |
| P1.7* | Extender Zod a otros boundaries Supabase (parcial: 3 hotspots cubiertos en 11.66.0) | M | Bajo |
| Cx | Bajar complejidad 13 funciones src/ + 4 edge functions a ≤12 | M | Medio |

## P1.7 — Estado parcial

Cubiertos en 11.66.0:
- `lib/parsers/dashboard.ts` (peso 14) → `dashboardSchemas.ts`
- `lib/mappers/embarqueToDb.ts` (peso 12) → `embarquePayloadSchemas.ts`
- `services/embarque/queries/exportListado.ts` (peso 10) → `embarqueRowSchema.ts`

Pendientes (orden sugerido por peso):
- `components/admin/TabSeguridadGlobal.tsx` (peso 12)
- `lib/audit/diffFields.ts` (peso 12)
- `services/embarque/documentos.ts` (peso 12)
- `components/auditoria/HallazgosFiltros.tsx` (peso 10)
- `hooks/embarque/useProformas.ts` (peso 10)

## Próximo paso

**Cx** (complejidad) o continuar P1.7 sobre los hotspots restantes. Recomendado P1.7 por continuidad y bajo riesgo.
