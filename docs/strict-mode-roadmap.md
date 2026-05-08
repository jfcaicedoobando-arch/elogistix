# Strict Mode Roadmap

Plan para activar `strictNullChecks` (y eventualmente `strict: true`) en
TypeScript sin romper el build. Compañero de [`cast-audit.md`](./cast-audit.md).

## Estado actual

- `strict`, `strictNullChecks`, `noImplicitAny` → **off** en `tsconfig.app.json`.
- `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` → **on** (PR-3).
- ~559 `as` casts. Distribución: 73 HIGH+CRITICAL (~13 %), 316 MEDIUM (mayoría
  en mappers DB↔dominio), resto SAFE/LOW.

## Por qué no activamos `strictNullChecks` ya

Activarlo hoy reportaría ~800 errores reales. La mayoría no son bugs — son
casos donde un cast `as X` está enmascarando un valor potencialmente nulo o
indefinido. Hay que **bajar la deuda primero** para que el flag sea útil y no
una sopa de errores que invitan a más casts.

## Roadmap (4 fases)

### Fase A — Quick wins ✅ COMPLETADA (8.124.0)

- [x] Confirmado que los 9 `as any` reportados eran **falsos positivos**:
      strings literales dentro de descripciones de changelog en
      `src/content/changelog/v*.ts`. El proyecto **no tiene `as any`** en
      código ejecutable.
- [x] `scripts/audit-casts.ts` actualizado: elimina strings (`"`, `'`, `` ` ``)
      y excluye `src/content/changelog/**` antes del scan.
- [x] Política documentada en `ARCHITECTURE.md` §17.b.

**Salida actual:** `bun scripts/audit-casts.ts` → 0 CRITICAL, 64 HIGH, 316 MEDIUM, 7 LOW, 120 SAFE (total 507).

### Fase B — Validación de boundaries (2-3 PRs)

Reducir los 64 HIGH (`as unknown as X` y `as X[]` sin validar).

**Sub-fase B.1 — Helper centralizado ✅ COMPLETADA (8.125.0)**

- [x] Nuevo `src/lib/supabase/cast.ts` con `fromDb<T>(data)` y `toDbJson(value)`.
- [x] Migrados ~50 `as unknown as X` en 17 archivos (services, contexts, hooks, parsers).
- [x] Resultado: HIGH 64 → 15 (los 15 restantes son mocks de tests con
      `as unknown as ReturnType<typeof X>` y `as unknown as typeof fetch`,
      aceptables bajo política).

**Sub-fase B.2 — Validación runtime ✅ COMPLETADA (8.127.0)**

- [x] `fromDb` admite sobrecarga con Zod schema opcional:
      `fromDb<S extends ZodType>(data, schema)` valida y devuelve el tipo
      inferido; la sobrecarga sin schema sigue disponible como cast crudo
      documentado.
- [x] Adoptado Zod en hotspots: `services/embarque/mutations.ts` (RPCs
      `crearEmbarqueRpc` y `duplicarEmbarqueRpc`) y `services/portal/queries.ts`
      (joins anidados `clientes(nombre)` / `organizations(nombre)`).
- [x] Tests `src/lib/supabase/__tests__/cast.test.ts` (6 casos) verifican
      que payloads malformados lanzan `ZodError` en vez de propagar
      `undefined`.

**Limitación documentada:** con `strictNullChecks=false`, `z.infer<S>` marca
los campos como opcionales aunque Zod los valide como requeridos. En los
hotspots usamos `schema.parse(data)` para validar y luego `fromDb<T>(data)`
para tipar correctamente. Cuando se active el flag (Fase D), podremos
colapsar a una sola llamada `fromDb(data, schema)`.

**Por qué Zod y no type guards:** Zod añade ~12 KB gz pero da mensajes de
error con path exacto (`expediente: Required`) y zero boilerplate. Solo se
usa en boundaries (services), no en componentes.

### Fase C — Mappers DB↔dominio ✅ COMPLETADA (8.126.0)

- [x] Verificado: 0 `as Tables<>` / `as TablesInsert<>` fuera de
      `lib/mappers/*`, `services/*/queries.ts`, `services/*/index.ts`.
- [x] Los 2 outliers detectados se corrigieron:
      - `pages/portal/PortalCotizacionDetalle.tsx`: narrowing local.
      - `services/cotizacion/conversiones/embarques.ts`: canalizado por `fromDb<>`.
- [ ] (Pendiente, opcional) Lint rule custom para enforcement automático.

### Fase D — Activar `strictNullChecks` ✅ COMPLETADA (8.128.0)

- [x] Flip del flag en `tsconfig.json` y `tsconfig.app.json`.
- [x] `tsc --noEmit` reportó **14 errores reales** (vs ~800 estimados antes
      de Fases A-C). Triados y reparados uno por uno.
- [x] Patrones aplicados:
  - Narrowing correcto en ramas `else` (BloqueVinculacion: el binding ya
    era null en la rama, removido el check redundante que confundía a TS).
  - Guards explícitos antes de mutaciones (DialogMarcarFacturada).
  - Defaults `?? ""` / `?? 0` en parámetros de RPC que el dominio modela
    como nullable pero la firma SQL exige non-null (consolidar_proformas).
  - Conversiones `?? undefined` cuando la firma generada por Supabase usa
    `T | undefined` en vez de `T | null` (profit_por_cliente).
  - Interfaces de domain types relajadas para aceptar `null` proveniente
    de joins de Supabase (CostoCotizacion del wizard).
- [ ] Pendiente opcional: activar `noImplicitAny`, finalmente `strict: true`.

**Resultado:** suite 285/285 verde, `tsc --noEmit` limpio. Las Fases A-C
pagaron la deuda con anticipación: la activación final fue casi trivial.

## Política para nuevos casts (vigente desde este PR)

Ver `ARCHITECTURE.md § Type assertions policy`. Resumen:

| Categoría | ¿Permitido? | Requiere comentario |
|-----------|-------------|---------------------|
| SAFE      | Sí          | No |
| LOW       | Sí          | Sí (`// cast: razón`) |
| MEDIUM    | Solo en `lib/mappers/*` y `services/*/queries.ts` | Sí |
| HIGH      | No (excepto tests con justificación) | Obligatorio + revisor senior |
| CRITICAL  | **No** | Bloquea el merge |

CI futuro: `bun scripts/audit-casts.ts` debería fallar si CRITICAL > 0 o si
HIGH crece respecto al baseline.

## Métricas baseline (2026-05-08)

| Categoría | Count |
|-----------|------:|
| SAFE | 163 |
| LOW | 7 |
| MEDIUM | 316 |
| HIGH | 64 |
| CRITICAL | 9 |
| **Total** | **559** |
