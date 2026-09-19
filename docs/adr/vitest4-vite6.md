# ADR — Vitest 3 → 4 con prerequisito Vite 5 → 6

**Fecha:** 2026-09-19 · **Estado:** aplicado (infraestructura de pruebas)

## Contexto

Vitest 4.1.x declara en `peerDependencies`:

```
vite: "^6.0.0 || ^7.0.0 || ^8.0.0"
```

El repo estaba en Vite 5.4.21. Un intento previo de fijar Vitest 4.0.x
(la última línea que no declara Vite como peer) quedó descartado: forzar
Vitest 4 sobre Vite 5, o resolverlo con `overrides`, deja el runner fuera
de la matriz soportada por upstream.

## Decisión

Vite 6 es **prerequisito técnico de Vitest 4**, no parte de la futura
iniciativa "Vite 5 → 8". El alcance se limita a lo estrictamente necesario:

| Paquete               | Antes    | Después |
| --------------------- | -------- | ------- |
| `vite`                | ^5.4.21  | ^6.4.3  |
| `vitest`              | 3.2.4    | 4.1.9   |
| `@vitest/coverage-v8` | 3.2.4    | 4.1.9   |

No se tocaron React Router, Tailwind, TypeScript, `@hookform/resolvers`,
`@react-pdf/renderer` ni Vite 7/8. `@vitejs/plugin-react-swc` se conserva en
la major 3 (su peer es `vite: ^4 || ^5 || ^6`) y `lovable-tagger` declara
`vite: >=5.0.0 <9.0.0`; ningún plugin requirió subir major.

## Cambios de configuración (Vitest 4)

- `test.poolOptions` fue eliminado: sus claves son opciones de primer nivel.
  `maxForks` → `maxWorkers`, `minForks` eliminado; `execArgv`, `isolate` y
  `fileParallelism` se declaran dentro del bloque común por proyecto, porque
  el pool se resuelve por proyecto.
- Se conservan: proyectos `node`/`jsdom`, pool `forks`, límites de memoria
  (`--max-old-space-size` + `--expose-gc`), reporter JUnit bajo CI, aliases de
  `@react-pdf/renderer`, sharding y merge de blob reports, y los thresholds de
  cobertura actuales (no se recalibró nada).
- `vi.fn()` infiere tipos más estricto: un test de tipos requirió firma
  explícita (`vi.fn<() => void>()`).
- CI invoca `bun run test -- --shard=N/3`; no hay referencias incompatibles en
  los workflows.

## Validación local

- `bun run typecheck`, `bun run lint`, `bun run build` (Vite 6) en verde.
- Suite completa: 1,632 archivos, todos en verde. La corrida con
  `--coverage` no cabe en el sandbox por memoria (instrumentación v8 +
  forks); la comparación de porcentajes la hace GitHub Actions por shards.

## Riesgos residuales

- Vite 6 cambia el target por defecto a `baseline-widely-available` y el
  manejo de `sass`/`lightningcss`; el build de producción se verificó y el
  bundle sigue generando los mismos chunks y el gate de `index.html`.
- La cobertura real bajo Vitest 4 podría diferir; si CI muestra una caída
  medible causada por la herramienta, documentarla antes de recalibrar.
