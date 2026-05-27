# Auditoría arquitectónica — Libre Carga (estado 11.62.0)

> **Bloques A, B, C9, D15 cerrados.** Diagnóstico original archivado en
> `mem://audit/pendings`.

## 1. Métricas baseline (post D15)

| Métrica | 11.45.0 | 11.62.0 | Meta |
|---|---:|---:|---:|
| Hooks/Contexts con Supabase directo | 28 | **0** ✅ | 0 |
| Components/Pages con Supabase directo | 1 | **0** ✅ | 0 |
| Archivos productivos >200 líneas | 2 | **0** ✅ | 0 |
| `any` / `console.*` productivos | 0 | **0** ✅ | 0 |
| Suites en `services/` | — | **18** ✅ | ≥10 |
| Total tests | 709 | **729** | crecer |
| Casts HIGH + CRITICAL | — | **37** | 0 |

## 2. Bloques cerrados

- **A (11.54→11.59.1):** 33 hooks/contexts migrados a `services/`.
- **B (11.60.0):** 0 archivos productivos >200. Split de `services/crm/leads`, `BulkImportDialog`, `ImportarLeadsCsvDialog`, `lib/query/index.ts`.
- **C9 (11.61.0):** helpers no-hook movidos de `hooks/crm/` a `lib/crm/`.
- **D15 (11.62.0):** reporte CI consolidado. `scripts/audit-report.ts` agrega arch + casts + tests y CI publica `reports/audit-report.{md,json}` (artifact 30d + step summary en PRs). Lógica compartida extraída a `scripts/lib/{walk,arch,casts,tests}.ts`.

## 3. Pendiente

### Bloque C — Consistencia
- **C10.** 25 `style={{…}}` inline → tokens Tailwind / semánticos.
- **C11.** ❌ Descartado (carpetas de dominio desambiguan duplicados).

### Bloque D — Opcional
- **D12.** Dividir `routes.tsx` (188) en `routes/{admin,portal,crm,public}.tsx`.
- **D13.** Vigilar archivos 180–200 líneas (lista en mem://audit/pendings).
- **D14.** Añadir aserción `archivosProductivosOver200 === 0` al `architecture-baseline.test.ts` como guardrail explícito (hoy se reporta pero no se gatea).
- **D16.** Reducir 37 casts HIGH (`services/embarque/mutations.ts`, `services/portal/queries.ts`, RPCs) a `fromDb(data, ZodSchema)`.

## 4. Orden recomendado

D14 (5 min, gating duro) → D16 (mayor ROI runtime) → C10 → D12.
