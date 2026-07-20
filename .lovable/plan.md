# Plan · Optimización de CI y ESLint

## Diagnóstico (verificado en repo, no supuestos)

El pipeline `.github/workflows/ci.yml` tiene un cuello de botella claro: **todo `quality` corre en serie en un solo runner**. Además:

1. `bun run lint` = `eslint .` sin `--cache` — reprocesa **2.696 archivos TS/TSX** en cada PR, aunque cambies uno.
2. Se corren **knip dos veces**: `lint:unused` y `lint:unused:strict` (el segundo es superset del primero).
3. `audit:arch`, `audit:casts`, `audit:tests` son 3 procesos `tsx` seriales.
4. Los **architecture gating tests** de `src/lib/__tests__/architecture*.test.ts` se ejecutan **dos veces**: dentro de `quality` (paso "Architecture gating tests") y otra vez como parte del shard de Vitest normal (matrix 1/20…20/20).
5. `bun run build` en CI corre con `ANALYZE=true` (genera `bundle-stats.html`), lo que agrega Rollup visualizer a cada PR.
6. `tsc --noEmit` sin `--incremental` ni cache de `tsbuildinfo`.
7. Matrix de tests: **20 shards** con `retry=2` y coverage — el merge espera al shard más lento.
8. El workflow no tiene filtro de `paths` diferenciado: cambios en `supabase/functions/**` disparan el job entero de `quality` + `tests` aunque sólo tocaste edge functions (y viceversa `edge-functions` corre siempre).

## Cambios propuestos

### 1 · Partir `quality` en jobs paralelos (mayor ganancia)

Hoy es un solo job de ~10–12 min secuencial. Lo dividimos en jobs que corren en paralelo (mismo cache de Bun):

```text
quality (hoy, serial)
 ├─ lint            ~2 min
 ├─ typecheck       ~2 min
 ├─ knip            ~1 min
 ├─ knip strict     ~1 min
 ├─ audits (x3)     ~1 min
 ├─ arch tests      ~1 min
 └─ build+bundle    ~3 min

quality (nuevo, paralelo)
 ├─ lint            ─┐
 ├─ typecheck       ─┤ todos en paralelo, wall-time ≈ el más lento (~3 min)
 ├─ knip:strict     ─┤   (drop del knip no-strict, es subset redundante)
 ├─ audits+arch     ─┤
 └─ build           ─┘
```

Bundle analyzer (`ANALYZE=true`) se mueve **fuera del path caliente**: sólo se ejecuta en push a `main`, no en cada PR.

### 2 · Cachear ESLint

- Agregar `--cache --cache-location node_modules/.cache/eslint/` a `bun run lint` y cachear ese directorio en Actions con key derivada de `eslint.config.js` + `bun.lockb`.
- En corridas incrementales, ESLint sólo revisa los archivos cambiados: se reduce típicamente de ~90 s a ~10–15 s.

### 3 · Cachear TypeScript incremental

- Agregar `"incremental": true` + `"tsBuildInfoFile": "node_modules/.cache/tsc/tsconfig.tsbuildinfo"` a `tsconfig.json` (o sólo para `typecheck`).
- Cachear ese archivo en Actions. Reduce typecheck de ~90 s a ~15–30 s en PRs típicos.

### 4 · Eliminar trabajo duplicado

- **knip**: quitar el paso `bun run lint:unused` del CI y dejar sólo `lint:unused:strict` (mismo comando, más flags). Ahorra ~45 s.
- **Architecture gating tests**: hoy corren en `quality` y quedan también capturados por el matrix de Vitest. Los sacamos de `quality` (ya cubiertos por el shard) o los excluimos del matrix con `--exclude`. Ahorra ~40 s duplicados y libera un runner.
- **Audits en paralelo**: `bun run audit:arch & bun run audit:casts & bun run audit:tests & wait` dentro del mismo job (son procesos IO/CPU-ligeros e independientes).

### 5 · Reducir el matrix de tests

- Bajar de **20 → 10 shards**. Con 2.696 archivos y `--reporter=dot`, 20 shards tiene overhead de arranque (setup Bun + install + cache warm ≈ 40 s × 20 = 13 min de billing) que **domina** sobre el tiempo real de ejecución.
- Mantener `retry=2` sólo en shards que probaron ser flaky (o quitar y arreglar los flaky).
- Los `smoke_test.ts` de edge functions ya se excluyen — mantener.

### 6 · Filtros por path

- `quality` no debe correr si el PR sólo toca `supabase/functions/**` o `e2e/**`.
- `edge-functions` no debe correr si el PR sólo toca `src/**`.
- `tests` no debe correr si el PR sólo toca `.github/workflows/**` o `docs/**` (ya está el `paths-ignore` de docs).

Se implementa con `dorny/paths-filter` o con `paths:` a nivel workflow segmentado por trigger.

### 7 · Cambios menores en ESLint config

- `eslint.config.js` tiene **473 líneas**. Se puede reducir tiempo de arranque:
  - Mover el bloque `NO_RESTRICTED_SYNTAX_BASE` y las 8 excepciones (`src/components/ui/**`, tests, edge functions, `*Columns.tsx`, etc.) a un `eslint.overrides.js` importado — no cambia funcionalidad pero facilita el próximo paso.
  - Confirmar que `dist`, `coverage`, `.vitest-reports`, `reports/**`, `node_modules` estén en `ignores` (hoy sólo `dist, coverage`). Agregar `**/*.md`, `public/**`, `supabase/migrations/**`.
  - Verificar que `react-compiler/react-compiler` (plugin pesado) esté sólo en `**/*.{ts,tsx}` y no re-evalúe archivos ya filtrados.

### 8 · `ci:fast` local (script existente)

- Ya paraleliza lint + typecheck + vitest fast. Añadir `--cache` a su invocación de eslint. Sin cambios estructurales.

## Estimación de impacto

| Métrica                        | Hoy       | Después   |
| ------------------------------ | --------- | --------- |
| Wall-time PR típico (1 archivo)| ~14 min   | ~6–7 min  |
| Wall-time PR grande            | ~18 min   | ~9 min    |
| Minutos-runner facturados/PR   | ~180 min  | ~90–100 min |
| ESLint incremental             | ~90 s     | ~10–15 s  |
| Typecheck incremental          | ~90 s     | ~20–30 s  |

## Detalles técnicos

**Archivos a modificar:**
- `.github/workflows/ci.yml` — split de `quality` en 4–5 jobs, path filters, matrix a 10 shards.
- `package.json` — `"lint": "eslint . --cache --cache-location node_modules/.cache/eslint/"` (o script `lint:ci` separado si se prefiere no mutar el DX local).
- `tsconfig.json` — habilitar `incremental` + `tsBuildInfoFile`.
- `.github/actions/setup-bun/action.yml` — cachear también `node_modules/.cache/eslint` y `node_modules/.cache/tsc` con key derivada de configs.
- `eslint.config.js` — ampliar `ignores`, extraer overrides.
- Opcional: nuevo `scripts/ci-quality-parallel.sh` para reproducir localmente el paralelismo de CI.

**Riesgos:**
- Cache de ESLint puede quedarse rancio si cambia una regla no reflejada en el hash. Mitigación: incluir `hashFiles('eslint.config.js')` en la key.
- `incremental` de TS puede ocultar errores tras rename masivo. Mitigación: invalidar cache cuando cambia `tsconfig.json` o hay un salto de versión de `typescript`.
- Path filters pueden esconder regresiones cross-cutting (un cambio en `src/` que rompe un edge function). Mitigación: en `push` a `main` correr **todos** los jobs sin filtros (ya lo está con `push: [main]`).

**Fuera de alcance:**
- No tocamos `codeql.yml`, `gitleaks.yml`, `e2e.yml`, `rls-tests.yml` (ya corren en paralelo y con su propio trigger).
- No cambiamos coverage thresholds ni la lógica de merge de blobs.
- No sustituimos `bun install` por `npm ci` ni cambiamos runner (`ubuntu-24.04`).
