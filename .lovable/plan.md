## Problema

Al guardar el Paso 1 del wizard de nueva cotización, el schema `cotizacionInputSchema` exige `conceptos_venta.min(1)`. Pero en el flujo del wizard, el Paso 1 (Datos Generales) crea la cotización con `conceptos_venta: []` — los conceptos se capturan hasta el Paso 3. Esto rompe la creación desde 12.0.0-rc.x.

Ver `src/lib/mappers/cotizacion.ts` (`buildPaso1Data` → `conceptos_venta: []`) vs `src/lib/validation/mutationSchemas.ts:117`.

## Solución

1. **`src/lib/validation/mutationSchemas.ts`** — Cambiar `conceptos_venta: z.array(conceptoVentaSchema).min(1, ...)` a `z.array(conceptoVentaSchema)` (sin `min(1)`). La regla "al menos un concepto" es de UI/flujo, no de persistencia: el borrador puede existir sin conceptos y se completan en Paso 3. El Paso 3 ya valida en el wizard antes de avanzar.

2. **`src/lib/validation/__tests__/mutationSchemas.test.ts`** — Invertir el test "rechaza sin conceptos" → "acepta sin conceptos (borrador)".

3. **`CHANGELOG.md` + `src/constants/appVersion.ts`** — Bump a `12.0.0-rc.4`, entrada: "fix(cotizaciones): permitir crear cotización en Paso 1 sin conceptos_venta (se capturan en Paso 3)".

## Archivos a tocar

- `src/lib/validation/mutationSchemas.ts`
- `src/lib/validation/__tests__/mutationSchemas.test.ts`
- `src/constants/appVersion.ts`
- `CHANGELOG.md`