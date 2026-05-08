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

- [ ] Definir helper `parseRow<T>(data: unknown, schema): T` o adoptar Zod.
- [ ] Aplicar primero en hotspots:
  - `src/services/cotizacion/crud.ts` (11 HIGH)
  - `src/services/embarque/mutations.ts` (10 HIGH)
  - `src/services/__tests__/tracking.test.ts` (4 HIGH — testing helpers, OK con comentario)
- [ ] Meta: HIGH < 20.

**Decisión pendiente:** Zod (peso ~12 KB gz, valida runtime) vs. type guards
manuales (cero peso, más boilerplate). Recomendación: Zod solo en boundaries
(services), no en componentes.

### Fase C — Mappers DB↔dominio (2 PRs)

Los 316 MEDIUM son mayormente `as Tables<X>` sobre respuestas de Supabase.
Aceptables **dentro de `lib/mappers/*`**; fuera, son code smell.

- [ ] Mover los `as Tables<>` que viven fuera de `lib/mappers/*` adentro.
- [ ] Lint rule custom (eslint plugin local) que prohíba `as Tables<` fuera
      de `lib/mappers/` o `services/*/queries.ts`.
- [ ] Hotspots a auditar: `src/lib/parsers/dashboard.ts` (6 MEDIUM),
      `src/components/admin/TabSeguridadGlobal.tsx` (6 MEDIUM).

### Fase D — Activar `strictNullChecks` (1 PR grande)

- [ ] Flip del flag en `tsconfig.app.json`.
- [ ] Ejecutar `tsc --noEmit` y triagear errores por archivo.
- [ ] Patrones de fix preferidos:
  - `x?.foo` para acceso opcional
  - `x ?? defaultValue` para fallback
  - `if (!x) throw new Error(...)` (assertion narrativa) cuando el null
    sería un bug real
  - `invariant(x, "msg")` helper en `lib/errors`
- [ ] Estimación post-Fases A-C: 100-300 errores (vs. ~800 hoy).
- [ ] Después: activar `noImplicitAny`, finalmente `strict: true`.

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
