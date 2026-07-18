## Contexto

La columna "Emisión" (fecha de emisión) **ya existe** en la tabla de facturas (`src/features/facturacion/routes/facturacionColumns.tsx`, línea 72), pero tiene la clase `hidden xl:table-cell`, lo que la oculta en pantallas por debajo de 1280 px. Como el viewport actual del usuario es 980 px, la columna no se ve.

## Cambio propuesto

Hacer visible la columna **Emisión** en todos los tamaños en la bandeja de Emitidas.

**Archivo:** `src/features/facturacion/routes/facturacionColumns.tsx`

- Quitar `hidden xl:table-cell` del `meta` de la columna `emision` (líneas 72–75) para que se muestre siempre.
- Mantener el ancho `w-[110px]` y el resto de columnas sin cambios.

## Nota sobre las otras bandejas

Las bandejas "Por timbrar" y "Por enviar" ya muestran una columna de Emisión propia; no se tocan. Emitidas era la única donde estaba oculta por breakpoint.

## Versionado

- Bump `APP_VERSION` a `13.301.63`.
- Entrada breve en `CHANGELOG.md`: "Bandeja Emitidas: columna Fecha de emisión visible en todos los tamaños de pantalla."
