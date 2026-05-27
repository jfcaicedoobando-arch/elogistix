# Auditoría Cleanslate — v11.69.0

> Fecha: **2026-05-27** · Último cleanslate antes de iniciar nuevos módulos.
> Ejecutado sobre `src/` (1025 archivos `.ts/.tsx`, 905 productivos).
> Todas las cifras se generaron con los scripts versionados en `scripts/`.

## 1. Snapshot por categoría

| Categoría | Métrica | Estado | Fuente |
|-----------|---------|--------|--------|
| Tests | 119 suites / **770/770** verdes | ✅ | `bunx vitest run` |
| Higiene de tests | 0 violaciones | ✅ | `bun scripts/audit-tests.ts` |
| Arquitectura — imports prohibidos | 0 hooks/contexts, 0 components/pages con import directo a `@/integrations/supabase/client` | ✅ | `bun scripts/audit-architecture.ts` |
| Arquitectura — oversized productivos (>200 líneas) | 0 (excepción `ui/sidebar.tsx` 637, shadcn) | ✅ | mismo script |
| Casts HIGH/CRITICAL productivos | **0 / 0** sobre 730 casts (40.7% SAFE, 1.6% LOW, 57.7% MEDIUM en `lib/mappers/*`) | ✅ | `bun scripts/audit-casts.ts` |
| `any` explícito (excl. tests) | **0** | ✅ | `grep ': any\b\| as any\b'` |
| `useEffect` sin cleanup | 1 falso positivo (`AuthContext.tsx`) | ✅ | heurística |
| Queries de lista sin paginar | 68 (mismo conteo histórico; pendiente Cx-list) | ⚠️ | heurística |
| Complejidad ciclomática | 38 funciones con CC 13-15 (umbral objetivo 12) | ⚠️ | ESLint API |
| Inline styles estáticos | política activa, sin nuevos hallazgos | ✅ | `mem://principles/inline-styles` |

## 2. Tests

- 119 archivos / 770 tests / 0 fallos.
- Suite de performance estable: `VirtualDataTable` mount 10k mediana 83.6 ms; rerender 5k same-data 0.6 ms.
- Ningún archivo `__tests__` viola las reglas de higiene declaradas en `scripts/audit-tests.ts`.

## 3. Casts (post P1.7)

- Total: **730** (vs 750 en 11.59.x → -20 tras P1.7 + Cx fase 1).
- Eliminados todos los HIGH residuales gracias a 6 schemas Zod nuevos:
  - `lib/parsers/dashboardSchemas.ts`, `lib/mappers/embarquePayloadSchemas.ts`, `services/embarque/queries/embarqueRowSchema.ts`
  - `hooks/configuracion/configSchemas.ts`, `services/embarque/idempotencyClaimSchema.ts`, `components/auditoria/hallazgosFiltrosSchemas.ts`
- MEDIUM (421) son `as Tables<X>` / `as TablesInsert<X>` confinados a `lib/mappers/*` — aceptable por política D16.

## 4. Power of 10

| Regla | Hallazgos | Notas |
|-------|-----------|-------|
| #2 Paginación en listas | 68 | Heurística amplia; cubierto por `server-side-pagination` en flujos principales (`embarques`, `cotizaciones`, `crm`). Pendiente repasar listas secundarias. |
| #3 Cleanup en effects | 1 (AuthContext) | Falso positivo verificado: el cleanup vive en `onAuthStateChange` interno. |
| #4 >200 líneas | 0 productivos | Guardrail D14 activo en `architecture-baseline.test.ts`. |
| #5/#10 `any` | 0 | Guardrail mantenido. |

## 5. Complejidad — 38 ofensores (CC > 12)

Distribución por capa:

| Capa | # | Detalle relevante |
|------|---|-------------------|
| `services/` | 8 | `embarque/queries/paginados.ts` (15), `proforma/facturar.ts` (15), `bitacora/index.ts` (15), `cotizacion/queries.ts` (14), `crm/leads/convertir.ts` (14), `cotizacion/conversiones/embarques.ts` (13), `cliente/financials.ts` (13). |
| `lib/` | 8 | `csv/parseCsv.ts` (15), `domain/bitacoraDescripcion.ts` (15), `crm/forecast.ts` (15), `domain/proforma.ts` (14), `csv/importSchemaCliente.ts` (13), `crm/leadEditDirty.ts` (13), `crm/oportunidadFormHelpers.ts` (13), `jsoncargo/trackingLiveHelpers.ts` (13). |
| `hooks/` | 7 | `operaciones/useOperacionesData.ts` (15), `auditoria/useAsignarResponsableController.ts` (15), `configuracion/useConfiguracionState.ts` (14), `embarque/useEmbarquesPageState.ts` (14), `crm/useCrmHotkeys.ts` (13), `crm/useCrmInicioVM.ts` (13), `embarque/useEditarEmbarqueWizard.ts` (13). |
| `components/` | 10 | Peor: `cotizacion/conceptos/ConceptoRowUSD.tsx` (15). Resto CC 13-14 (`SeccionRutaCotizacion`, `ConceptoRowMXN`, `OportunidadDetalleContent`, `QuickCreateOportunidadPopover`, `EtapasPipelineEditor`, `DataTable`, `DataTableHeaderRow`, `HallazgosTabla`, `DialogBolContainers`). |
| `pages/` | 5 | `crm/Oportunidades.tsx` (15), `admin/AdminDashboard.tsx` (15), `portal/PortalCotizacionDetalle.tsx` (15), `cotizaciones/CotizacionDetalle.tsx` (13), `embarques/NuevoEmbarque.tsx` (13), `portal/PortalEmbarqueDetalle.tsx` (13). |

Umbral ESLint sigue en `complexity: ["warn", { max: 15 }]`. Plan: bajar a 12 cuando el contador llegue a 0.

## 6. Pendientes priorizados (antes de nuevos módulos)

| Prioridad | Tarea | Razón |
|-----------|-------|-------|
| **Alta** | Cx fase 2 — reducir los 7 ofensores `services/*` y 8 `lib/*` (todos funciones puras, riesgo bajo) | Bloquea bajar umbral ESLint y son los más reutilizados. |
| Media | Cx fase 3 — hooks + pages (15 ofensores) | Más invasivo; requiere descomposición de componentes/hooks. |
| Media | P1-Paginación — auditar 68 hallazgos de queries sin `.range()` para descartar falsos positivos | Riesgo de scans completos si el dataset crece. |
| Baja | Edge functions (4 con CC > 12) | Fase posterior; viven fuera del lint principal. |
| Baja | Revisión preventiva de archivos 180-200 líneas (D13) | Continuo. |

## 7. Recomendación

La baseline está **lista para arrancar nuevos módulos**:

- 0 violaciones bloqueantes (arquitectura, casts, `any`, oversized, tests).
- Lo pendiente (complejidad y paginación) es deuda gestionable, no riesgo de regresión.
- Sugerido: cerrar **Cx fase 2 (services + lib)** en paralelo a los primeros features del próximo módulo, para llegar a CC ≤ 12 antes de fin de iteración.

## 8. Cómo reproducir

```bash
bun scripts/audit-casts.ts          # → docs/cast-audit.md
bun scripts/audit-architecture.ts   # → stdout
bun scripts/audit-tests.ts          # → stdout
bun scripts/audit-report.ts         # → reports/audit-report.{md,json}
bunx vitest run                     # 770 tests
# Complejidad (no hay script dedicado todavía):
node -e "import('eslint').then(async ({ESLint})=>{const e=new ESLint({overrideConfig:[{files:['**/*.{ts,tsx}'],rules:{complexity:['warn',{max:12}]}}],overrideConfigFile:'eslint.config.js'});const r=await e.lintFiles(['src/**/*.{ts,tsx}']);for(const x of r)for(const m of x.messages)if(m.ruleId==='complexity')console.log(x.filePath.split('/src/')[1]+':'+m.line,m.message)})"
```
