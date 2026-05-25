## Loop 9 — Cierre final de auditoría

Al medir el estado real con ESLint el panorama cambió:

- **Barrel violations: 0** (P0.1 ✅ ya cerrado)
- **Mappers `embarque*` / `cotizacion*`: complejidad ≤12** (P0.3 ✅ ya cerrado en loops anteriores; la memoria está desactualizada)
- **Lo que queda: 14 warnings de `complexity > 15` y 2 `react-hooks/exhaustive-deps`**

Este loop cierra esos 16 warnings para poder endurecer ESLint (P2.12).

### Alcance

**A. Reducir complejidad (14 funciones, todas >15):**

| Archivo | Función | Complejidad | Estrategia |
|---|---|---|---|
| `hooks/crm/useOportunidadForm.ts` | arrow L56 | 23 | Extraer `buildOportunidadPayload()` + `resolveDefaults()` |
| `lib/parsers/dashboard.ts` | `parseEmbarqueConProfitRaw` | 23 | Partir en `parseHeader` + `parseProfit` + `parseFechas` |
| `lib/ui/errorReport.ts` | `formatReportMarkdown` | 22 | Una función por sección (`fmtError`, `fmtContext`, `fmtBreadcrumbs`) |
| `hooks/crm/useLeadEditForm.ts` | arrow L73 | 20 | Extraer normalizadores a `leadEditHelpers.ts` |
| `hooks/crm/leads/mutations.ts` | `mutationFn` L10 | 20 | Extraer `buildLeadInsertPayload()` |
| `hooks/crm/leads/bulk.ts` | arrow L51 | 19 | Extraer `applyBulkPatch()` |
| `hooks/crm/useOportunidades.ts` | `mutationFn` L92 | 19 | Extraer `buildOportunidadUpdate()` |
| `lib/ui/errorReport.ts` | `extractErrorDetails` | 18 | Separar `extractStack` + `extractCause` |
| `pages/dashboard/SentryDiagnostico.tsx` | comp | 17 | Mover handlers a hook `useSentryDiagnostico` |
| `contexts/AuthContext.tsx` | arrow L73 | 16 | Extraer `resolveEffectiveRole()` |
| `components/shared/VirtualDataTable.tsx` | comp | 16 | Extraer `useVirtualRows()` |
| `lib/crm/forecast.ts` | `computeForecast` | 16 | Extraer `bucketByMonth()` |
| `lib/parsers/dashboard.ts` | `parseArribosEsteMes` | 16 | Extraer filtro por mes a helper |
| `pages/crm/CrmDashboard.tsx` | comp | 16 | Mover cálculo de KPIs vencidas a hook |

Meta: **todas ≤12** (umbral objetivo de P2.12).

**B. Resolver exhaustive-deps (2):**

- `pages/crm/Leads.tsx` L38 → envolver `leads` en `useMemo`.
- `pages/crm/Oportunidades.tsx` L65 → envolver `opsRaw` en `useMemo`.

**C. Verificación:**

1. `bunx vitest run` → 626+ tests verdes.
2. `bunx eslint src` → 0 `complexity` y 0 `exhaustive-deps`.
3. Mantener Power of 10 (componentes ≤200 LOC, sin `any`).

**D. Cierre administrativo:**

- `APP_VERSION` → **11.21.0**
- Nueva entrada en `src/content/changelog/v8/chunks/0.ts` y `changelogData.ts`.
- Actualizar `mem://audit/pendings`: marcar ✅ P0.1, P0.3, P0.4, y dejar como únicos pendientes P1.5–P1.8 y P2.9–P2.12.

### Fuera de alcance

- `react-refresh/only-export-components` (3) → trivial, lo arrastro si surge.
- `no-explicit-any` en `__tests__/embarqueRoundtrip.test.ts` → lo limpio si está en el camino.
- P1.5/1.6/1.7/1.8, P2.10/11/12 → quedan para próximos loops.
- Edge functions, RLS, `integrations/supabase/*` → intactos.

### Riesgo

Bajo. Todas las extracciones son refactors puros sin cambio de comportamiento; los tests de mappers/CRM (626 suites) son la red de seguridad.
