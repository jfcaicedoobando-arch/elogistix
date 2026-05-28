# Power of 10 — Baseline

_Re-generado en cleanslate v11.69.0 sobre **1025 archivos `.ts/.tsx`** (905 productivos) de `src/`._

Las heurísticas son conservadoras (prefieren falsos positivos). Validar manualmente antes de refactorizar. Ver `ARCHITECTURE.md` §20 y `docs/audit-cleanslate-11.69.0.md`.

## Resumen

| Regla | Hallazgos |
|---|---:|
| #4 Componentes/archivos productivos >200 líneas | 0 ✅ (excepciones `ui/sidebar.tsx` shadcn y `pdf/theme/styles.ts` react-pdf) |
| #5/#10 `any` explícito (excl. tests) | 0 ✅ |
| #3 `useEffect` sin cleanup | 1 (falso positivo en `AuthContext`) |
| #2 Queries de lista sin paginar | **0 RISK** ✅ (174 inspeccionadas: 151 OK · 23 CATALOG · 0 RISK — ver `docs/pagination-audit.md`) |
| Inline `style={{…}}` no justificados | **0 ✅** (64 auditados, todos exentos — ver `docs/inline-styles-audit.md`) |
| Complejidad ciclomática > 12 | 38 (umbral lint actual: 16; CC ≤ 15 aceptable) |

## Regla #4 — Archivos productivos >200 líneas (0) ✅

Bloque B cerrado en 11.60.0 y regresiones post-12.0.0 cerradas en 12.1.0 (Fase 1 plan auditoría).

Splits históricos (11.60.0):
- `services/crm/leads.ts` → carpeta `services/crm/leads/{queries,mutations,bulk,convertir,index}.ts` (≤106 cada uno).
- `ImportarLeadsCsvDialog.tsx` (67) + `useImportarLeadsCsv` + `ImportarLeadsCsvPreview` + `lib/csv/leadsCsv.ts`.
- `BulkImportDialog.tsx` (114) + `BulkImportDialogParts.tsx` + `lib/csv/downloadCsvTemplate.ts`.

Splits en 12.1.0:
- `SeccionDestinatario.tsx` (321 → 113) + `seccionDestinatario/{ProspectoSection,VinculoChip,BuscadorProspectos,FormularioNuevoProspecto}`.
- `DialogDuplicarEmbarque.tsx` (265 → 84) + `duplicarEmbarque/{useDuplicarEmbarqueDialog,CopiaContenedorRow,types}`.
- `useCotizacionWizardSteps.ts` (212 → 163) + `handlePaso1Crm.ts`.
- `services/crm/vincularCotizacion.ts` (202) → carpeta `vincularCotizacion/{helpers,vincularOCrear,sincronizarEtapa,propagarConversion,index}` (≤76 cada uno).

**Excepciones documentadas (no cuentan como deuda):**
- `src/components/ui/sidebar.tsx` (637) — código base shadcn/ui sin modificar.
- `src/pdf/theme/styles.ts` (278) — `StyleSheet.create()` de @react-pdf/renderer: API exige objeto único con todos los estilos del PDF; dividirlo rompería la cohesión del documento. Inline-styles allí están permitidos por `mem://principles/inline-styles`.



## Regla #5/#10 — `any` explícito (0)

Reemplazar por tipos generados de Supabase, `unknown` + narrowing, o documentar override según §17.b.

_Sin hallazgos._

## Regla #3 — `useEffect` sin cleanup (heurística) (1)

Verificar manualmente: bloques con `.subscribe(`/`setInterval(`/`setTimeout(`/`addEventListener(` que parecen no retornar cleanup. Falsos positivos posibles cuando el cleanup vive en función externa.

| Dominio | Hallazgos |
|---|---:|
| `contexts/AuthContext.tsx` | 1 |

<details><summary>Detalle</summary>

- `src/contexts/AuthContext.tsx:52` — useEffect con suscripción/timer/listener sin cleanup

</details>

## Regla #2 — Queries `.from().select()` sin `.range/.limit/.single` (0 RISK ✅)

Reauditado en v11.70.0 con `scripts/audit-pagination.ts` (heurística refinada que cruza `let q = supabase.from(...)` con `q.range()` en lookahead y reconoce `.in()` por FK, `.insert().select()`, y allowlist de catálogos).

| Bucket | # | Significado |
|--------|--:|-------------|
| OK | 151 | Filtro por PK/FK, `.range/.limit/.single`, paginado en chain split, count-only o `.insert().select()`. |
| CATALOG | 23 | Tabla en allowlist (catálogos estáticos, configuración por org, miembros, etapas CRM, etc.). |
| RISK | 0 | Sin paginar y sin filtro acotante. ✅ |

Caps defensivos aplicados en v11.70.0:
- `services/auditoria/snapshots.ts` — `.limit(2000)` (snapshots por rango de fechas).
- `services/crm/forecast.ts` — `.limit(5000)` en `fetchForecast` y agregados de `fetchReportesCRM` (leads/oportunidades).
- `services/crm/leaderboard.ts` — `.limit(5000)` en oportunidades cerradas del mes.
- `services/facturas/index.ts` — `.limit(2000)` en `fetchGastosPendientes`.

Detalle completo: ver `docs/pagination-audit.md`.
