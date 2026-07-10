# Auditoría "App como Lego": Candidatos a npm o paquete interno

**Analogía:** hoy la app tiene muchas piezas que fabricamos a mano; algunas se pueden reemplazar por piezas de Lego oficiales (npm público), y otras conviene guardarlas en una caja marcada "Libre Carga" (paquete interno) para reutilizarlas en futuras apps.

## Lo que dejamos intocado (dominio Libre Carga)

Estas piezas son el "ADN" del producto — no existen en ninguna librería y migrarlas costaría más de lo que ahorra:

- Roles multi-tenant (`roleHierarchy`) y RLS.
- Reglas SAT: tasas IVA, RFC, CURP, régimen fiscal, CP.
- Costos marítimos: DAP, THC, seguros, tarifas por kg/m³.
- Integración FacturAPI, referencias de embarque, incoterms.
- Scrub PII de Sentry con validaciones MX.
- Formateo tipográfico con siglas MX (S.A. de C.V., CFDI, etc.).
- Idempotencia `useStableRequestId` acoplada a RPCs.

## Migración a npm público (piezas Lego estándar)

Cambios directos, bajo riesgo, ~260 LOC menos:


| #   | Reemplaza                              | Con                                       | LOC |
| --- | -------------------------------------- | ----------------------------------------- | --- |
| A1  | `useDebouncedValue` + `useDebounce`    | `use-debounce`                            | ~32 |
| A2  | `useIsMobile`                          | `usehooks-ts` → `useMediaQuery`           | ~30 |
| A3  | `fetchWithRetry`                       | `ky` (retry + timeout nativos)            | ~92 |
| A4  | `passwords/generator.ts`               | `generate-password` + `@zxcvbn-ts/core`   | ~84 |
| A5  | `formatters/dates.ts` (thin wrappers)  | `date-fns` + `date-fns/locale/es` directo | ~35 |
| A6  | `csv/serializeCsv.ts`                  | `papaparse.unparse()` directo             | ~15 |
| A7  | `financialUtils` — wrappers no-dominio | `currency.js` directo                     | ~60 |


## Extracción a paquete interno (caja "Libre Carga")

Piezas propias reutilizables entre apps del mismo equipo. Se quedan en el repo pero organizadas para poder publicarse a un registry privado más tarde:

**P1 · `@librecarga/supabase-utils**` (~230 LOC)

- `unwrap` / `unwrapOr` / `run` de `lib/supabase/response.ts`
- `useMutationWithFeedback`
- `createCatalogHooks`

**P2 · `@librecarga/pdf-components**` (~400 LOC)

- `BrandHeader`, `Footer`, `KeyValueGrid`, `TotalesBox`, `DataTable` PDF
- Los documentos de negocio (cotización, proforma, EERR) importan desde aquí.

**P3 · `@librecarga/data-table**` (~470 LOC)

- Wrapper de `@tanstack/react-table` con densidad, sticky, sort server/client, empty state, row href accesible.

## Plan de ejecución por lotes (independientes, mergeable)

Cada lote termina con lint + typecheck + tests verdes, bump `APP_VERSION` y entrada en `CHANGELOG.md`.

**Lote 9a — Reemplazos npm de bajo riesgo** (~200 LOC menos)

1. `bun add use-debounce usehooks-ts` → migrar `useDebouncedValue`, `useDebounce`, `useIsMobile`.
2. Eliminar `csv/serializeCsv.ts` → `papaparse.unparse()`.
3. Adelgazar `formatters/dates.ts`: dejar sólo constantes de locale, reexportar `format`/`parseISO` con default.

**Lote 9b — Reemplazos npm de riesgo medio** (~180 LOC menos)
4. `bun add ky` → migrar `fetchWithRetry` (verificar edge functions + servicios de importación).
5. `bun add generate-password @zxcvbn-ts/core @zxcvbn-ts/language-common @zxcvbn-ts/language-es-es` → migrar generator + evaluator, revisar UI de creación de usuarios.

**Lote 9c — Adelgazar `financialUtils**` (~60 LOC menos, riesgo medio)
6. Marcar como `@deprecated` los thin wrappers (`sumarMontos`, `calcularIVA` cuando no lleva reglas SAT).
7. Barrer call-sites uno a uno para usar `currency.js` directo.
8. Mantener intactas `resolverTasaConcepto`, `TASAS_IVA_MX`, `calcularMargen` (dominio).

**Lote 9d — Paquetes internos vía path alias** (0 LOC menos; prepara reutilización)
9. Crear estructura `packages/supabase-utils/`, `packages/pdf-components/`, `packages/data-table/` en el mismo repo (monorepo ligero con `tsconfig` paths).
10. Mover los archivos actuales sin renombrar imports (usar re-exports desde `@/lib/...` a `@librecarga/...`).
11. Documentar en `README.md` de cada paquete su superficie pública.
12. Preparado para publicar a un registry privado más tarde sin más refactor.

## Métricas objetivo

- Líneas propias eliminadas: **~1,400 LOC** (Lotes 9a-9c).
- Piezas empaquetadas para reutilización: **~1,100 LOC** en 3 paquetes internos (Lote 9d).
- Dependencias nuevas: 5 (`use-debounce`, `usehooks-ts`, `ky`, `generate-password`, `@zxcvbn-ts/core` + locales). Impacto en bundle: `<25 KB` gzipped total.

## Detalles técnicos

- `ky`: preferido sobre `axios` porque usa `fetch` nativo, ~5 KB gzip, retry + timeout built-in. Alternativa considerada: dejar `fetch` puro + `p-retry`, pero doble dependencia.
- `usehooks-ts`: tree-shakeable, tipado estricto. Alternativa: `react-use` (bundle mayor, menos tipado).
- `@zxcvbn-ts/core`: fork moderno con TS nativo. Alternativa clásica: `zxcvbn` (untyped, 400 KB si no se hace code-split).
- Los paquetes internos se ubican en `packages/*` con `workspaces` de bun; NO se publican todavía a npm — sólo estructura preparada para hacerlo si aparece un segundo proyecto que los necesite.

---

**Pregunta antes de ejecutar:** ¿Ejecutamos los 4 lotes en orden (9a → 9d), o prefieres empezar sólo con **Lote 9a** (reemplazos npm de bajo riesgo, ROI inmediato ~200 LOC menos, ~1 hora de trabajo)? hacemos todos los lotes