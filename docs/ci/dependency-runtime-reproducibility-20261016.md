# Reproducibilidad de runtimes y comandos — 2026-10-16

Revisión limitada desde `main` en
`9b5bc7d9cc7c115e9bd108c5b778ae2a17c599bd`. Las fuentes de verdad son
`package.json`, `bun.lock`, `.github/actions/` y `.github/workflows/`.
Este registro describe el alcance del cambio; los resultados de ejecución
y el SHA final se reportan en el PR, sin atribuirles validaciones anteriores.

## Contrato del paquete y de CI

| Elemento | Decisión |
| --- | --- |
| `engines.node` | Conservar `>=22.22.0`, mínimo deliberado por Router 8 |
| Runtime para reproducir CI | Node `24.22.0`, instalado antes del primer comando Node de cada job general que lo usa |
| Bun | `1.4.0`, declarado mediante `packageManager: bun@1.4.0` y conservado en el setup compartido |
| Tipos de Node de la raíz | Major 24 para corresponder al runtime de CI; resolución exacta en `bun.lock` |
| Instalación de dependencias | Lockfile congelado y `--ignore-scripts`, sin cambios de política de caché |
| `test:ci` | Ejecutar tests normales sin coverage y permitir filtros/shards |
| `ci:local` | Lint sin warnings → typecheck → Knip → tests normales → build |
| `test:coverage:merge` | Consumir blobs previos de `.vitest-reports`; no producirlos ni ejecutar tests desde cero |

El setup compartido ya fijaba Node `24.22.0`. El detector fijaba `24.19.0`
después de ejecutar el plan de shards y el catálogo con el Node del runner;
el agregador verificaba la evidencia con ese runtime implícito. Se explicita
Node `24.22.0` antes de sus comandos. RLS, smoke y replay NC también dejan
de depender del Node preinstalado del runner para sus scripts.

La declaración `packageManager` no instala por sí sola Bun y `engines` no
selecciona el ejecutable de Node. Reproducir con `node --version` = `v24.22.0`,
`bun --version` = `1.4.0` y la instalación congelada de CI.
Los tipos de Node describen APIs para TypeScript; la compilación no acredita
por sí sola que una API esté disponible en todo el rango de `engines`.

### Excepciones de revisión histórica

`demo-wire-lab.yml`, `demo-authority-entry-review.yml` y
`demo-persistence-prerequisites.yml` conservan Node `24.19.0`. Sus jobs están
restringidos a ramas de revisión concretas; el laboratorio físico también
exige una base exacta. Sus hashes, fixtures y contratos del runtime se conservan.
Actualizar estos carriles exigiría revisar su evidencia por separado.

## Remotion: discrepancia registrada, sin migración

`remotion/` es un proyecto con manifiesto, lockfile y configuración propios;
`tsconfig.json` raíz sólo referencia `tsconfig.app.json` y `tsconfig.node.json`.
Por tanto, `bun run typecheck` en la raíz no valida Remotion.

| Fuente | Declaración o resolución observada |
| --- | --- |
| `package.json` raíz / `bun.lock` | TypeScript `^6.0.3` / `6.0.3` |
| `remotion/package.json` | Peer TypeScript `5.8.3` |
| `remotion/bun.lock` | Entrada resuelta TypeScript `7.0.2`, aunque su workspace conserva el peer `5.8.3` |
| `remotion/package.json` / `remotion/bun.lock` | `@types/bun: latest` / `1.3.14`; `bun-types` admite `@types/node: *`, resuelto en `26.1.1` |

El lockfile propio evita asumir que Remotion hereda TypeScript o los tipos
de Node de la raíz. Su discrepancia peer/resolución y los rangos abiertos
de tipos necesitan revisión independiente antes de regenerar el lockfile.
Este cambio no instala, compila, renderiza ni modifica Remotion, y no acredita
que su instalación congelada o sus peers sean compatibles.

## Alcance conservado y límites

Se conservan las versiones React, TanStack, Tailwind, el minificador, las
políticas de caché, los guards y los 14 shards sin coverage de PR/push.
No se cambian componentes, hooks, APIs del producto, permisos, secretos,
bases de datos ni despliegues.

`ci:local` añade typecheck sin retirar Knip, pero no sustituye los guards DB,
Deno, RLS ni la unión de evidencia de Actions. `test:ci` deja de depender de
reports existentes; el merge optativo de coverage conserva su nombre explícito.

Dependabot sólo cubre Actions y Bun de la raíz. Dependency Review dispara por
los manifiestos de la raíz y aplica su umbral a dependencias de runtime;
no equivale a validar los tipos de desarrollo, Remotion ni imports Edge.
Se conserva esa configuración: ver [mantenimiento del stack](../stack-mantenimiento.md)
y [CI vigente](../ops/ci.md).
