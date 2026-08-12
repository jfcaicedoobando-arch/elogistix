# Limpieza de tests triviales y deuda de configuración

Sin tocar lógica de negocio. Todo lo verificado abajo se comprobó leyendo los archivos.

## 1. Tests de barrel triviales

De los 19 archivos `services/**/__tests__/index.test.ts`, sólo **3** son puramente `toBeDefined` (los otros 16 sí ejercitan Supabase/RPCs y se conservan):

- `src/features/auditoria/services/__tests__/index.test.ts`
- `src/features/cxp/services/__tests__/index.test.ts`
- `src/features/presupuesto/services/__tests__/index.test.ts`

Se borran esos tres.

## 2. Tests de constantes literales

Borrar:

- `src/features/catalogos/hooks/__tests__/useTasaIVA.test.tsx`
- `src/features/embarques/constants/__tests__/embarqueConstants.test.ts`
- `src/constants/__tests__/constantsSmoke.test.ts`
- `src/pdf/theme/__tests__/tokens.test.ts`

Nota: `estados-embarque-sync.test.ts` NO se borra (es un guardrail contra la máquina de estados de BD).

## 3. package.json

Eliminar el script `test:shards:serial` (línea 22). `test:shard` se mantiene.

## 4. src/test/setup.ts

Quitar el bloque `if (process.env.CI) { ... }` de instrumentación `[shard-trace]` FILE_START/FILE_END y sus imports que queden sin uso (`afterAll`, `beforeAll` si ya no se usan en el resto del archivo).

## 5. vitest.config.ts

El comentario menciona `@vitest/coverage-v8 v4.1.9`, pero la versión instalada es **3.2.4**. Corregir sólo el texto del comentario; los valores de thresholds (lines/statements 38, etc.) quedan idénticos.

## Verificación final

Correr en orden: `bun run lint`, `bun run typecheck`, `bun run test:shard`. Si la cobertura baja del umbral por borrar tests, se añaden tests reales del código afectado — no se baja el threshold.

Se registra el cambio en `CHANGELOG.md` con bump de `APP_VERSION`.
