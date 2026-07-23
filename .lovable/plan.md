## Contexto — estado real del plan

Revisé el documento subido contra el repo actual. Casi todo Bloque 1 y 2 ya está aplicado en v13.309.0–12:

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| 1.1 scanner `src/features` | ✅ | `scripts/lib/arch.ts:73` incluye `src/features` |
| 1.2 path eslint | ✅ | `eslint.config.js:502` apunta al path correcto `facturacion/services/dashboardEjecutivo.ts` |
| 1.3 tipos fuera de `.tsx` | 🟡 casi | Tipos ya viven en `src/features/cxp/types/{facturaForm,embarque,index}.ts`. Quedan **re-exports muertos** en 3 `.tsx` (`FacturaProveedorFormFields.tsx:28`, `SugerirEmbarqueBlock.tsx:24`, `VincularEmbarqueSection.tsx:26`) sin consumidores. |
| 1.4 sin `: any` en detalle factura | ✅ | grep vacío |
| 1.5 AuthContext desacoplado | ✅ | `src/lib/contexts/AuthContext.tsx` no importa `@/features/**` |
| 1.6 supabase.client en `.tsx` | 🟡 | Solo queda 1: `cotizacion/services/mutations/enviarPorEmail.tsx` (JSX en services, listado también en Bloque 4 §5) |
| 2.1 traducción LC_ | ✅ | `src/lib/errors/lcCodeMessages.ts` |
| 2.2 invariantes esquema | ✅ | `supabase/tests/schema-invariants.sql` |
| 2.3(a) shared promotion | ✅ | `ProfitBadge` en `components/shared`, `badgeTone` en `lib/ui`, `estadoUnificado` en `lib/domain` |
| 2.3(b) eslint cross-feature | ❌ | Aún ~640 imports `@/features/*/{components,domain,lib}/*` cross-feature |
| 2.4 TASA_IVA | ✅ | 0 literales `0.16` fuera de `financialUtils` |
| 3.1 fuentes canónicas SQL | ✅ | `supabase/schema/{auditoria,embarques,facturacion,proformas}/*.sql` |
| 3.2 god-functions | 🟡 3/5 | ✅ `auditoria_embarques_org`, `convertir_proformas_a_factura`, `crear_embarque_borrador_core`. Pendientes: **`operaciones_stats` (307 L)** y `calcular_demoras_embarque` (236 L) |

**Orden del documento:** "Bloque 1 → 2 → 3 → 4, dentro de cada bloque el orden es el de ejecución". Los residuales de Bloque 1 (1.3 dead re-exports y 1.6 enviarPorEmail.tsx) son follow-ups triviales de <10 min cada uno. El siguiente ítem *sustantivo* pendiente es continuar 3.2.

## Alcance de este turno (un commit, regla de oro #1)

Refactor puro de `public.operaciones_stats` (307 líneas). Es la siguiente god-function según el orden del ítem 3.2. Firma pública y contrato JSON de retorno **byte-idénticos**.

## Cómo se divide

1. Leer la definición actual desde DB vía `supabase--read_query` sobre `pg_proc` (aún no existe en `supabase/schema/`; parte del ítem 3.1 fue solo las 10 más redefinidas — `operaciones_stats` no estaba en esa lista, así que primero se **crea** la fuente canónica).
2. Identificar bloques por concern (típicamente: KPIs por estado, agregados por modo, agregados por operador, top clientes, series temporales). Cada bloque termina construyendo una porción del `jsonb_build_object` final.
3. Extraer 2–3 helpers privados `_operaciones_stats_<concern>(p_org uuid, ...)` que devuelven `jsonb` — mismo SQL interno, copia literal.
4. El orquestador público arma el `jsonb_build_object` final llamando a los helpers.
5. `SECURITY DEFINER`, `SET search_path`, permisos y `GRANT`s del orquestador **inalterados**. Helpers privados: `REVOKE ALL FROM PUBLIC/anon/authenticated`, `GRANT EXECUTE TO service_role`.

## Migración

- Un archivo: `supabase/migrations/<ts>_split_operaciones_stats.sql`.
- Contiene `CREATE OR REPLACE FUNCTION` de los helpers + el orquestador (mismo nombre y firma, sin `DROP`).
- Sin cambios en tablas, RLS, ni datos.

## Fuentes canónicas nuevas

- `supabase/schema/operaciones/operaciones_stats.sql` (orquestador refactorizado).
- `supabase/schema/operaciones/_operaciones_stats_<concern>.sql` × N helpers.

(Se crea el subdirectorio `operaciones/` — patrón ya establecido con `auditoria/`, `embarques/`, `facturacion/`, `proformas/`.)

## Verificación

1. `supabase--read_query` ANTES: `SELECT operaciones_stats('<org>')` sobre 1–2 orgs con datos → guardar output.
2. Migración aplicada → mismo query → **diff debe ser vacío** (comparación textual del JSON).
3. `bun run lint`, `bunx tsgo`, `bunx vitest run` — verdes.
4. Snapshot de invariantes (2.2) sigue verde (no se dropean triggers).
5. CHANGELOG + `APP_VERSION` → `13.309.13`.

## Riesgos y mitigación

- **Función no está en fuentes canónicas del 3.1.** Riesgo bajo — creo la fuente canónica ahora, con la definición actual como línea base pre-refactor comentada en el commit message.
- **Retorno `jsonb` con orden de claves distinto entre helpers.** Mitigación: el orquestador arma el `jsonb_build_object` final; los helpers devuelven fragmentos que se concatenan con `||`, preservando el orden semántico. Si al diseñar veo que el orden actual depende de la construcción monolítica, me detengo (regla de oro #6) y reporto.
- **Función podría ser `SETOF` o `TABLE(...)` en vez de `jsonb`.** Verifico el `RETURNS` real antes de tocar nada.

## Fuera de alcance de este turno

- `calcular_demoras_embarque` (última god-function de 3.2) — su propio PR.
- Residuales 1.3 (dead re-exports) y 1.6 (`enviarPorEmail.tsx`) — PRs de 5 min cada uno, no bloquean 3.2.
- 2.3(b) ESLint no-restricted cross-feature (640 imports) — Bloque 2 residual grande, propio PR.

## Entregables

- `supabase/migrations/<ts>_split_operaciones_stats.sql`
- `supabase/schema/operaciones/operaciones_stats.sql` + helpers `_operaciones_stats_*.sql`
- Entrada en `CHANGELOG.md`
- `APP_VERSION` → `13.309.13`
