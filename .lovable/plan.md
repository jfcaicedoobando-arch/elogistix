# Sprint 2.1 — Estabilización de Tests CI

Resolver los 10 fallos detectados en las shards 1/5/6/11/13 sin abrir nuevo scope. Todas las fallas son regresiones introducidas durante Sprint 2 más deuda nueva del feature de eliminación de embarques.

## Diagnóstico por grupo

### G1 · Regresión IVA en MXN (2 tests)
**Archivos productivos:**
- `src/lib/domain/proforma.ts` (línea 56)
- `src/hooks/cotizacion/usePortalCotizacionDetalle.ts` (línea 28)

**Causa:** ambos usan `resolverTasaConcepto(c, tasaIva)` para MXN. Esa helper devuelve `0` cuando `aplica_iva` es `false`/`undefined` y `tasa_iva_aplicada` no está seteada. El contrato de dominio dice "MXN siempre lleva IVA".

**Fix:** para conceptos MXN ignorar el flag y usar `tasaIva` global directo:
```ts
const tasa = c.tasa_iva_aplicada ?? tasaIva; // MXN siempre aplica
```
USD mantiene `resolverTasaConcepto` + overrides.

### G2 · Mock roto en exportCsv (4 tests)
**Archivo test:** `src/generators/__tests__/exportCsv.test.ts`

**Causa:** el spy de `document.createElement('a')` devuelve un objeto plano. Tras centralizar `descargarBlob` (12.61.8) ahora se llama `document.body.appendChild(a)` que requiere un Node real.

**Fix:** sustituir el mock por uno que extienda un `<a>` real:
```ts
const a = document.createElement.call(document, 'a') as HTMLAnchorElement;
const origClick = a.click; a.click = () => { lastClicked = { href: a.href, download: a.download }; };
return a;
```
O mockear `descargarBlob` directamente y assertir parámetros (filename + Blob). Preferimos lo segundo: aísla mejor y elimina dependencia del DOM.

### G3 · Hook con import directo a Supabase (1 test arch)
**Archivo nuevo:** `src/features/embarques/hooks/useEmbarqueDependenciasFinancieras.ts`

**Fix:** mover el fetch a `src/services/embarques/dependenciasFinancieras.ts` exportando `fetchEmbarqueDependenciasFinancieras(embarqueId)`. El hook queda como wrapper de `useQuery` consumiendo el service. Esto también elimina los dos casts HIGH (líneas 44-45) porque el service tipa el `select` correctamente.

### G4 · Casts HIGH residuales (2 hits)
**Archivo:** `src/lib/parsers/cotizacionDetalle.ts:22-23`
```ts
conceptosVentaUSD: Object.freeze([]) as unknown as ConceptoVentaCotizacion[],
```
**Fix:** marcar con `// SAFE-CAST: array vacío congelado, sin riesgo runtime` o tipar el helper genérico:
```ts
const EMPTY_CV = Object.freeze<ConceptoVentaCotizacion[]>([]);
```
Preferimos la 2ª: elimina el cast.

### G5 · Archivos > 200 líneas (2 tests)
| Archivo | Líneas | Acción |
|---|---|---|
| `src/features/embarques/components/StepCostosPrecios.tsx` | 274 | Split: extraer `CostosPreciosTabla.tsx` (render filas) y `useStepCostosPrecios.ts` (estado/handlers) |
| `src/services/facturas/cobranza.ts` | 224 | Split: separar `cobranzaQueries.ts` (reads) y `cobranzaMutations.ts` (writes) |
| `src/features/embarques/components/DialogEliminarEmbarque.tsx` | 208 | Split: extraer `DialogEliminarEmbarqueBody.tsx` (contenido) del shell del Dialog |
| `src/lib/csv/parseCsv.ts` | 206 | Split: mover `toCsv` y helpers de escape a `src/lib/csv/serializeCsv.ts` |

Cada split debe preservar API pública (re-export desde el archivo original si hay imports externos). Vetados los aumentos a `OVERSIZED_BASELINE` — la política Power-of-10 lo prohíbe.

## Orden de ejecución

1. **G1** (2 ediciones, 2 tests verdes) — más urgente, afecta totales financieros.
2. **G3** (mueve hook→service) — destraba G4 parcialmente y test arch.
3. **G4** (parsers) — limpia casts HIGH residuales.
4. **G2** (refactor test de exportCsv).
5. **G5** (4 splits, mecánicos).
6. Bump `APP_VERSION → 12.61.18`, actualizar `CHANGELOG.md` y `docs/audit-tests-2026-06-08.md`.
7. Correr `bunx vitest run` completo + `bun run scripts/audit-report.ts` para confirmar 0 fallos / 0 HIGH / 0 oversized.

## Resultado esperado

- 385 → ~395 tests verdes (los 4 nuevos del service de dependencias).
- `audit-report`: `HIGH=0`, `CRITICAL=0`, `oversized=0`.
- `architecture.test.ts` y `architecture-baseline.test.ts` en verde sin tocar allowlists.

## Riesgos

- **Split de `StepCostosPrecios`**: tocar render puede romper snapshots; mitigar revisando los tests `useTabProformasController` y wizard tests existentes antes de mergear.
- **Refactor cobranza**: el service es consumido por `useFacturasCxC`; mantener re-export para no romper imports.
