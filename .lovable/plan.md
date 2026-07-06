## Objetivo

Que los renglones de conceptos en cotizaciones y en embarques (costos y ventas) **sólo** puedan capturarse eligiendo un producto del **Catálogo de productos y servicios** (`catalogo_claves_sat`). No texto libre, no listas hardcodeadas.

## Estado actual

- **Cotizaciones** (`ConceptoRowMXN.tsx`, `ConceptoRowUSD.tsx`, `ConceptoDescripcionSelector.tsx`): ✅ Ya usan `ProductoServicioSelect` (combobox estricto contra `catalogo_claves_sat`). Solo hay que verificarlo — no requiere cambios de código.
- **Embarques → Costos** (`FilaCostoPrecio.tsx`): ❌ Usa `<Select>` con la constante hardcoded `CATALOGO_CONCEPTOS` (18 valores estáticos en `embarqueConstants.ts`).
- **Embarques → Ventas** (`FilaVentaPrecio.tsx`): ❌ Mismo problema, misma constante.
- **TabCostos.tsx** (vista sólo-lectura del embarque): solo pinta `row.original.concepto`, no captura → nada que cambiar.

## Cambios

### 1. Nuevo combobox estricto para embarques

Crear `src/features/embarques/components/conceptos/ConceptoCatalogoSelect.tsx` — wrapper delgado sobre `ProductoServicioSelect` que:
- Recibe `value: string` (el nombre del concepto ya guardado).
- Al seleccionar un producto, emite sólo `p.nombre` (los renglones de embarque no guardan clave SAT / tasa IVA — esos viajan cuando se convierte a factura).
- Marca en `warning` los conceptos legacy (`Flete Marítimo`, etc.) que no existan en el catálogo maestro para forzar migración al reeditar.

Si es preferible, podemos reutilizar `ProductoServicioSelect` directo y llamar sólo con `onSelect={p => update(id,'concepto',p.nombre)}`; el wrapper es opcional (mejor por claridad y para tests).

### 2. Reemplazar los Select hardcoded

- `FilaCostoPrecio.tsx`: quitar `import { CATALOGO_CONCEPTOS }` y el `<Select value={costo.concepto} …>` por `<ConceptoCatalogoSelect value={costo.concepto} onChange={v => update(costo.id,'concepto',v)} />`.
- `FilaVentaPrecio.tsx`: idem con `venta.concepto`.

### 3. Deprecar el catálogo hardcoded

- Marcar `CATALOGO_CONCEPTOS` en `embarqueConstants.ts` con un JSDoc `@deprecated` (no la elimino en este PR porque puede aparecer en fixtures/tests; se limpiará cuando ripgrep confirme 0 usos productivos).
- Añadir test `src/features/embarques/__tests__/conceptos-catalogo.test.tsx` que renderiza `FilaCostoPrecio` y `FilaVentaPrecio` con un `catalogo_claves_sat` mockeado y verifica que las opciones del combobox provienen del catálogo, no de la constante.

### 4. Documentación / bitácora

- Nota en `CHANGELOG.md` bajo una nueva versión patch (`13.194.2`).
- Bump `APP_VERSION`.

## Notas técnicas

- `ProductoServicioSelect` ya maneja el caso "catálogo vacío" con mensaje que redirige a *Configuración → Facturación → Catálogo de productos y servicios*. Se hereda gratis para embarques.
- No se toca la BD: `conceptos_costo.descripcion` / `conceptos_venta.descripcion` siguen siendo `text` libre. Sólo se restringe la captura en UI.
- Fixtures y factories (`cotizacionFactory.ts`) usan strings arbitrarios en tests — no rompen porque la validación es sólo en UI (combobox), no en el esquema Zod.
- Riesgo bajo: los embarques históricos con `Flete Marítimo` etc. seguirán mostrándose (el combobox los marca legacy con ⚠️) hasta que el usuario los actualice al reeditar.

## Fuera de alcance

- Facturas emitidas (`FacturaConceptosEditorRows.tsx`) — ya tiene su propio flujo con clave SAT; no lo pediste explícitamente. Lo dejo listo para un siguiente sprint si quieres unificarlo.