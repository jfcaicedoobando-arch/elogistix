## Objetivo
Endurecer `useCotizacionDetalleState` y `parseConceptos` con validación defensiva del JSON de `conceptos_venta`, fallback limpio en caso de schema corrupto, y estabilización del `useMemo` para evitar loops de re-render.

## Cambios

### 1. `src/lib/parsers/cotizacionDetalle.ts`
- Reforzar `parseConceptos(raw)`:
  - `try/catch` alrededor de `JSON.parse` (hoy lanza si el string es inválido).
  - Validar que cada item tenga forma mínima (`moneda` ∈ `"USD"|"MXN"`, `cantidad` y `precio_unitario` numéricos finitos). Filtrar filas inválidas en vez de incluirlas.
  - Si el payload no es array ni string ni objeto válido → devolver `[]` y `console.warn("[cotizacionDetalle] conceptos_venta con formato inválido", { raw })`.
  - Garantizar pureza: no mutar el input (`map` con spread) para que el resultado sea referencialmente estable cuando la entrada no cambia.
- Añadir constante `EMPTY_TOTALES: ConceptosTotales` congelada (`Object.freeze`) y exportarla, usada como fallback canónico.
- `calcularTotalesConceptos`: si `conceptos.length === 0` retornar `EMPTY_TOTALES` (misma referencia → memos estables aguas abajo).

### 2. `src/hooks/cotizacion/useCotizacionDetalleState.ts`
- Cambiar dependencia de `useMemo` de `[cotizacion, tasaIva]` a `[cotizacion?.conceptos_venta, tasaIva]` para no recalcular cuando cambian campos irrelevantes del objeto cotización (la referencia de `cotizacion` puede cambiar por refetch aunque el JSON sea idéntico).
- Envolver el cuerpo del `useMemo` en `try/catch`:
  - En caso de error: `console.error("[useCotizacionDetalleState] error calculando totales", err)` y retornar `EMPTY_TOTALES` para no romper el árbol.
- `nombreDestinatario`: depender de los campos específicos (`cotizacion?.es_prospecto`, `cotizacion?.prospecto_empresa`, `cotizacion?.cliente_nombre`) en vez del objeto completo, evitando recálculos innecesarios.
- Sin cambios a los handlers ni al shape del return.

### 3. Tests — `src/lib/parsers/__tests__/cotizacionDetalle.test.ts` (extender o crear)
- `parseConceptos` con: `null`, `undefined`, string JSON válido, string JSON inválido, array con items malformados (faltan campos / `moneda` desconocida), objeto plano.
- `calcularTotalesConceptos([], 16)` retorna la **misma referencia** que `EMPTY_TOTALES` (test de identidad para garantizar estabilidad de memos).

### 4. Versionado
- `src/constants/appVersion.ts` → `12.61.3`.
- `CHANGELOG.md`: entrada `## [12.61.3] - 2026-06-08` con bullet describiendo el fallback defensivo y la estabilización del `useMemo`.

## Notas técnicas
- No se modifican firmas públicas; consumidores (`CotizacionDetalle`, portal) no requieren cambios.
- El fallback congelado evita el patrón "nuevo objeto cada render" que invalida memos descendentes.
- Las dependencias granulares del `useMemo` reducen recálculos sin perder correctness, porque `parseConceptos` sólo lee `conceptos_venta`.
