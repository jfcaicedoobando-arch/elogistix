# Auditoría DRY · Sprint hooks de datos (Supabase)

**Fecha:** 09/07/2026 · **Base:** `v13.226.0` · **Alcance analizado:** `src/` (1,827 archivos, excl. tests, backups y `integrations/supabase/types.ts`).

---

## TL;DR — La premisa del plan no se sostiene

El plan aprobado asumía **duplicación masiva de fetching/mutación de Supabase** en componentes. La auditoría con `rg` sobre patrones canónicos (`.range(`, `.channel(`, `.maybeSingle(`, `supabase.from(`) muestra que **el codebase ya tiene esa capa abstraída**:

- **Realtime:** exactamente **1** canal en todo `src/` (`src/features/notificaciones/services/index.ts`). No hay duplicación → no aplica `useSupabaseRealtime`.
- **Paginación `.range()`:** vive **exclusivamente en `services/` por feature** (crm, cxp, admin, auditoria, notificaciones), no en componentes. El patrón ya está encapsulado — cada feature tiene su propio contrato, pero no hay 3+ componentes repitiendo el mismo shape.
- **Detalle `.maybeSingle()`:** también vive en `services/` (portal, cxp, proveedor, proformas, embarques, crm). Encapsulado.
- **Fetching en componentes:** los componentes consumen los `services/*` de su feature, no llaman `supabase.from(...)` directo.

**Conclusión:** Aplicando la regla YAGNI del propio plan (*"Menos de 3 sitios reales de duplicación → no se extrae"*), **ninguno de los 7 hooks candidatos previstos alcanza el umbral**. Extraerlos ahora sería una abstracción prematura sobre código que ya está bien capado.

---

## Lo que la auditoría SÍ encontró (fuera del alcance aprobado)

El subagente localizó duplicación real y accionable, pero está en **capas distintas** a "hooks de datos":

| # | Hallazgo | Capa | Severidad | Sitios | Esfuerzo |
|---|---|---|---|---|---|
| U-1 | `AlertDialog` inline reimplementando `ConfirmActionDialog` / `DoubleConfirmDeleteDialog` | Componentes UI | **CRITICAL** | ~15 archivos, ~350 líneas | M |
| K-1 | Rutas hardcodeadas (`"/embarques"`, `"/facturacion"`, …) sin constante `ROUTES` | Constantes | **HIGH** | 10+ archivos | M |
| H-1 | `new Intl.NumberFormat("es-MX", { currency: "USD" })` inline en 4 archivos vs `formatCurrency` ya existente | Utils | **HIGH** | 4 archivos | S |
| C-1 | Headers de detalle ad-hoc en features vs `<DetailHeader />` compartido | Componentes UI | **HIGH** | 3 archivos, ~80 líneas | M |
| H-2 | `.toLocaleDateString("es-MX", …)` inline vs `formatDate` en `@/lib/formatters/dates.ts` | Utils | **HIGH** | 7 archivos | S |
| C-2 | KPI strips sin usar `<KpiCard>` / `<KpiStrip>` (0 imports en features) | Componentes UI | MED | 4 archivos | M |
| K-2 | Rutas relativas de portal sin constante | Constantes | MED | 6 archivos | S |
| U-3 | `usdFormatter` estático duplicado dentro del mismo feature `costeo` | Utils | MED | 2 archivos | S |
| H-3 | `cierreCheckFormatters.ts` — otro formatter de moneda local | Utils | MED | 2 archivos | S |
| K-3 | `.toLocaleString("es-MX")` numérico vs `formatNumber()` | Utils | LOW | 4 archivos | S |

Total: **~55 archivos** con duplicación real, **~500 líneas** eliminables.

Todas estas categorías fueron explícitamente marcadas como **fuera de alcance** en el plan aprobado:

> Fuera de alcance (explícito):
> - Refactor de componentes UI compartidos (cards, modales, headers) — se auditó pero se pospone.
> - Consolidación de utils/validaciones (financial, docs faltantes) — pospuesto a otro sprint.

---

## Hooks candidatos originales — dictamen

| # | Hook propuesto | Sitios reales encontrados | Dictamen |
|---|---|---|---|
| 1 | `useSupabaseList<T>` | 0 componentes; toda la paginación vive en `services/*` (encapsulada) | **DESCARTAR (YAGNI)** |
| 2 | `useSupabaseRealtime` | 1 solo canal en toda la app | **DESCARTAR (YAGNI)** |
| 3 | `useEntityById<T>` | 0 componentes; los detalles usan `services/*` | **DESCARTAR (YAGNI)** |
| 4 | `useOrgScopedMutation` | Mutaciones ya centralizadas en `services/*Crud.ts` por feature; no hay 3+ componentes repitiendo INSERT inline | **DESCARTAR (YAGNI)** |
| 5 | `useSoftDelete` | El patrón "typear ELIMINAR" ya está en `DoubleConfirmDeleteDialog` (componente, no hook) | **DESCARTAR (ya resuelto en UI)** |
| 6 | `useDebouncedFilter` | Debounce sí se repite (~4 sitios) pero como `useEffect + setTimeout`, no acoplado a Supabase | **CANDIDATO MENOR** (S, opcional) |
| 7 | `useFileDownload` | 2 sitios (documentos, facturas) — no llega a 3 | **DESCARTAR (YAGNI)** |

Único hook que sobrevive: `useDebouncedValue` (o `useDebouncedFilter`), y ya existe uno similar en `src/hooks/` — verificar antes de crear.

---

## Recomendación

**Pivotar el sprint** a lo que la auditoría sí encontró. Tres alternativas concretas para el usuario:

### Opción A — Pivotar a "Sprint DRY · UI y constantes" (recomendada)

Reemplazar el alcance del sprint por los 3 hallazgos CRITICAL/HIGH de la capa donde hay duplicación real:

1. **U-1 · Consolidar AlertDialogs** (CRITICAL, ~15 archivos): migrar todos los `AlertDialog` inline a `ConfirmActionDialog` / `DoubleConfirmDeleteDialog` existentes. Elimina ~350 líneas.
2. **K-1 · Crear `src/constants/routes.ts`** (HIGH): centralizar rutas hardcodeadas + migrar 10+ archivos.
3. **H-1 + H-2 + H-3 + K-3 · Formatters unificados** (HIGH, en un solo commit): borrar `usdFormatter`/`fmtFecha` inline y forzar uso de `@/lib/formatters`. Elimina ~50 líneas.

Estimación: 3 versiones minor. Riesgo bajo (solo búsqueda-reemplazo + typecheck + smoke).

### Opción B — Sprint mínimo de hooks

Ejecutar únicamente `useDebouncedValue` compartido (si no existe ya) y cerrar el sprint. ~1 versión patch.

### Opción C — Ejecutar el plan tal cual

Crear los hooks previstos aun sin duplicación real. Riesgo: código muerto o mal encajado, over-engineering. **No recomendado.**

---

## Evidencia (comandos ejecutados)

```
rg -c "supabase\.from\(" src --include-dir=features    → toda la señal está en services/
rg -l "\.channel\(" src/features src/hooks             → 1 solo hit
rg -c "maybeSingle\(\)" src/features                   → 100% en services/
rg -l "\.range\(" src/features                         → 100% en services/ (0 en componentes)
```

Reporte del subagente completo disponible en el historial de la conversación (agent `sub_kyy7pv1f`).
