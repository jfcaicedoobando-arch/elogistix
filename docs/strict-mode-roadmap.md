# TypeScript estricto y política de casts

El roadmap de activación está **cerrado**. Las fases y conteos anteriores
se conservan en Git; esta guía describe el resultado vigente.

## Configuración (2026-09-26)

TypeScript **6**. `tsconfig.app.json` activa `strict`, `strictNullChecks`,
`noImplicitAny`, `noUnusedLocals`, `noUnusedParameters` y
`noFallthroughCasesInSwitch`. `bun run typecheck` ejecuta `tsc -b`.
No desactivar flags ni reintroducir `baseUrl` antiguo para silenciar fallos.

## Boundaries y casts

- Preferir narrowing, tipos discriminados y mappers pequeños.
- Zod/guards validan datos externos donde corresponda.
- `fromDb<T>(data)` sin schema no valida runtime.
- `fromDb(data, schema)` / `schema.parse(data)` valida según el contrato.
- Dominio propio en el feature; `lib/domain` sólo para varios consumidores.
- No introducir `as any` o doble cast para esconder contratos incorrectos.
- Excepciones justificadas cerca del cast, con pruebas de sus límites;
  también para mocks.

`bun run audit:casts` genera [cast-audit.md](cast-audit.md).
La clasificación ayuda a revisar, no demuestra ausencia de bugs.
No afirmar que sea un gate automático del CI principal sin consultar
[CI](ops/ci.md). El reporte identifica su fecha de generación.
