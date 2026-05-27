# Auditoría arquitectónica — Libre Carga (estado 11.60.0)

> **Bloques A y B cerrados.** Diagnóstico original archivado en
> `mem://audit/pendings`. Este documento refleja el estado **actual** post
> migración + plan vigente para Bloques C/D.

## 1. Métricas baseline (post Bloques A + B)

| Métrica | 11.45.0 (diagnóstico) | 11.60.0 (actual) | Meta |
|---|---:|---:|---:|
| Hooks con `@/integrations/supabase/client` directo | 28 | **0** ✅ | 0 |
| Components con Supabase directo | 1 | **0** ✅ | 0 |
| Contexts con Supabase directo | 5 | **0** ✅ | 0 |
| Pages con Supabase directo | 0 | **0** ✅ | 0 |
| Archivos productivos >200 líneas (no shadcn) | 2 | **0** ✅ | 0 |
| `any` en código productivo | 0 | **0** ✅ | 0 |
| `console.*` en código productivo | 0 | **0** ✅ | 0 |
| Suites de tests en `services/` | — | **18** ✅ | ≥10 |
| Total tests | 709 | **728** | crecer |
| Subdominios en `services/` | 25 | **29** | — |
| `as` casts totales | 458 | **720** (37 HIGH) | bajar HIGH |

## 2. Bloque A — ✅ CERRADO (11.54.0 → 11.59.1)

33 hooks/contexts migrados a `services/{admin,crm,portal,embarque,auth,organization}/`.
Detalle por lote en historial de CHANGELOG. Test `architecture-baseline.test.ts`
con `Set` de excepciones vacío. Lint clean en `src/`.

## 3. Bloque B — ✅ CERRADO (11.60.0)

- **B1.** `services/crm/leads.ts` (209) → `services/crm/leads/{queries,mutations,bulk,convertir,index}.ts` (≤106 cada uno).
- **B2.** `components/crm/ImportarLeadsCsvDialog.tsx` (201→67): parser/mapper a `lib/csv/leadsCsv.ts` (+ tests), hook `useImportarLeadsCsv`, sub-componente `ImportarLeadsCsvPreview`.
- **B3.** `components/shared/BulkImportDialog.tsx` (200→114): `BulkImportDialogParts.tsx` + `lib/csv/downloadCsvTemplate.ts`.
- **B4.** `lib/query/index.ts` (256→65): partido por dominio en `lib/query/keys/*.ts` (14 archivos). Test `keys-shape.test.ts` protege la paridad.

## 4. Pendiente — Bloques C/D

### Bloque C — Consistencia
- **C9.** Renombrar helpers no-hook en `hooks/crm/` (`*Actions.ts`, `*Helpers.ts`, `*Payload.ts`) o moverlos a `lib/domain/crm/`. (Parcial: `oportunidadPayload`, `leadPayload` ya en `lib/`.)
- **C10.** Auditar 25 `style={{…}}` inline → tokens Tailwind / semánticos.
- **C11.** Homogeneizar prefijos en duplicados (`Configuracion.tsx`, `TabFacturacion.tsx`).

### Bloque D — Opcional
- **D12.** Dividir `routes.tsx` (188) en `routes/{admin,portal,crm,public}.tsx`.
- **D13.** Vigilar archivos 180–200 líneas (lista en mem://audit/pendings).
- **D14.** Test arquitectónico que bloquee Supabase directo en `hooks/`/`contexts/`. **YA EXISTE** vía `architecture-baseline.test.ts` + `scripts/audit-architecture.ts`. Pendiente: añadir aserción `archivosProductivosOver200 === 0` como guardrail.
- **D15.** Reporte CI automático con violaciones de capa y archivos oversized.
- **D16.** Reducir casts HIGH (37 → 0) migrando boundaries críticos a `fromDb(data, ZodSchema)` (`services/embarque/mutations.ts`, `services/portal/queries.ts`, RPCs).

## 5. Orden recomendado

Mayor ROI ahora: **D16** (casts HIGH, mejora seguridad runtime) o **C9/C11** (cosmético, fácil). Dejar D12/D15 para cuando haya hueco.
