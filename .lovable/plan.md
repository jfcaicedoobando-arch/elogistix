## Objetivo

Auditar y clasificar los ~495 `as` casts del proyecto, identificar los más peligrosos, y entregar un roadmap accionable para activar `strictNullChecks` en el futuro.

## Distribución actual (medida)

```text
as const               153   ✅ 100% seguro (literal narrowing)
as unknown              65   ⚠️  intermedio de `as unknown as X` — code smell
as Json                 21   ✅ wrapper de Supabase, seguro
as Tables/Insert/Update 10   ⚠️  casts DB → mejor con mappers
as any                   9   ❌ crítico
as React.*               3   ✅ usualmente OK
otros (~234)             —   mezcla (ReturnType<typeof...>, narrow DOM, etc.)
```

**Hotspots por archivo:**
- `src/lib/query/index.ts` — 91 (todos `as const`, claves de React Query — seguros)
- `src/services/cotizacion/crud.ts` — 22 (mezcla Json + unknown + Insert)
- `src/services/embarque/{queries,mutations}.ts` — 26 (Json + unknown + EmbarqueRow[])
- `src/services/auditoria/index.ts` — 8

## Entregables

### 1. Script de auditoría (`scripts/audit-casts.ts`)

Recorre `src/`, parsea cada `as X` con regex y lo clasifica en un CSV/Markdown:

| Categoría | Peso | Descripción |
|-----------|------|-------------|
| **SAFE** | 0 | `as const`, `as React.*`, `as ReturnType<typeof X>` en tests |
| **LOW** | 1 | `as Json` (wrapper Supabase), DOM narrowing tras chequeo |
| **MEDIUM** | 2 | `as Tables<X>`, `as TablesInsert<X>` en mappers |
| **HIGH** | 3 | `as unknown as X` (doble cast), `as X[]` sobre respuesta de Supabase sin validar |
| **CRITICAL** | 4 | `as any`, `as X` sobre `JSON.parse`, casts entre tipos no relacionados |

Output: `docs/cast-audit.md` con:
- Tabla resumen por categoría
- Top-20 casts más riesgosos con file:line y snippet
- Lista por archivo ordenada por peso descendente

### 2. Documento de roadmap (`docs/strict-mode-roadmap.md`)

Plan de 4 fases para llegar a `strict: true`:

**Fase A — Quick wins (1 PR)**
- Eliminar los 9 `as any` (reemplazar por `unknown` + type guard, o por tipo correcto).
- Agregar comentario `// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- razón` a los casts `LOW` que se mantienen.

**Fase B — Validación de boundaries (2-3 PRs)**
- Introducir Zod (o helpers manuales) para parsear respuestas de Supabase en los services hotspot (`cotizacion/crud.ts`, `embarque/queries.ts`).
- Eliminar `as unknown as X` en favor de `parseX(data)` que retorna el tipo real.
- Meta: bajar `as unknown` de 65 → <20.

**Fase C — Mappers DB↔dominio (2 PRs)**
- Reforzar `lib/mappers/*` para que sean la única frontera con `Tables<>`. Resto del código consume tipos de dominio sin castear.
- Eliminar los 10 `as Tables/Insert/Update` fuera de mappers.

**Fase D — Activar `strictNullChecks` (1 PR grande)**
- Activar flag, dejar que TS reporte errores reales.
- Estimación: 100-300 errores tras Fases A-C (vs. ~800 hoy).
- Resolver con `?.`, `??`, type guards y assertions narrativas (`if (!x) throw…`).

### 3. Cambios mínimos en código en este PR

Solo:
- `scripts/audit-casts.ts` (nuevo)
- `package.json`: script `"audit:casts": "tsx scripts/audit-casts.ts"`
- `docs/cast-audit.md` (generado, commiteado)
- `docs/strict-mode-roadmap.md` (nuevo)
- `ARCHITECTURE.md`: sección "Type assertions policy" con las 5 categorías y cuándo se permite cada una.
- Bump `APP_VERSION` a **8.123.0** + entrada en changelog.

## Lo que NO se hace en este PR

- **NO** se reescriben los 495 casts (sería un PR de cientos de archivos).
- **NO** se activa `strictNullChecks` todavía (Fase D, después de A-C).
- **NO** se introduce Zod ni nueva dependencia (el roadmap lo propone, no lo implementa).
- **NO** se tocan los 153 `as const` ni los `as Json` (son seguros).

## Resultado esperado

Tras este PR el equipo tiene:
1. **Visibilidad** total: cuántos casts hay, dónde, y de qué tipo.
2. **Top-20 priorizado** para arreglar primero (el ROI real está en ~30-50 casts críticos, no en 511).
3. **Plan claro** para activar `strictNullChecks` sin romper el build.
4. **Política escrita** en ARCHITECTURE.md para que nuevos casts pasen el code review.

## ¿Querés ajustar algo antes de implementar?

- ¿Te alcanza con el script + docs, o querés que en el mismo PR ya elimine los **9 `as any`** (Fase A)?
- ¿Preferís Zod o type guards manuales para Fase B (afecta el roadmap)?