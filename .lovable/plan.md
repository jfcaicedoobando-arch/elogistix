# No perder la selección de facturas al hacer clic en la fila

Hoy, en Cartera, cada fila completa funciona como enlace al detalle de la factura. Si el usuario apunta al checkbox y falla por unos píxeles, el clic cae en la fila y navega al detalle, perdiendo lo que ya había seleccionado.

## Qué cambia para el usuario

1. **La celda del checkbox deja de ser un blanco pequeño.** Todo el ancho y alto de la primera celda selecciona/deselecciona la fila (área táctil cómoda, sin navegar). Igual en el encabezado para "seleccionar todas".
2. **Modo selección.** En cuanto hay al menos una factura marcada, la tabla entra en modo selección: hacer clic en cualquier parte de la fila marca/desmarca esa factura en lugar de irse al detalle. Así, un clic mal apuntado nunca destruye el trabajo.
3. **Cómo abrir el detalle mientras hay selección:** el folio de la factura sigue siendo un enlace explícito (y Ctrl/Cmd + clic abre en pestaña nueva). Al vaciar la selección, la fila vuelve a comportarse como enlace normal.
4. **Barra de selección visible.** Al seleccionar aparece una franja fija sobre la tabla con: "N facturas seleccionadas · <cliente> · <moneda>", el botón **Cobro en lote**, y **Limpiar selección**. Cuando la mezcla no es válida (distintos clientes o monedas) la franja explica por qué el botón está deshabilitado, en lugar de sólo un tooltip.
5. **Salvaguarda al salir:** si el usuario navega al detalle desde el folio con facturas seleccionadas, se le confirma con un aviso corto de que perderá la selección.

## Detalles técnicos

- `src/components/shared/dataTable/DataTableBody.tsx`: nueva prop `selectionMode?: boolean`. Cuando es `true`, el `onClick`/`onKeyDown` de la fila llama `row.toggleSelected()` en vez de `handleRowClick`, y la fila deja de exponer `role="link"` (pasa a `role="row"` con `aria-selected`). Se propaga desde `DataTable.tsx` → `DataTableContent.tsx`.
- `src/components/shared/DataTable.tsx`: si no se pasa `selectionMode`, se deriva automáticamente de `Object.values(rowSelection).some(Boolean)`, para que todas las tablas con selección ganen el comportamiento sin cambios en cada pantalla.
- `src/features/bandejas/routes/_sections/carteraColumns.tsx`: la celda `selection` se envuelve en un contenedor `h-full w-full` con `data-no-row-nav`, padding generoso y `onClick` que hace toggle; el folio pasa a `<Link>` explícito con `data-no-row-nav`.
- Nuevo `src/features/bandejas/routes/_sections/CarteraSelectionBar.tsx` (<100 líneas): franja `sticky top-0 z-10` con conteo, cliente/moneda derivados de `derivarLoteCobro`, motivo de invalidez, botón "Cobro en lote" y "Limpiar selección". `Cartera.tsx` la monta arriba de la tabla y conserva el botón en el `PageHeader` sólo como atajo.
- `buildSelectionColumn.tsx` recibe el mismo tratamiento de área completa, para que el resto de tablas con selección (compras, facturación) hereden la mejora.
- Pruebas: unitarias de `DataTableBody` (clic en fila con selección activa hace toggle y no navega; sin selección navega), test de `CarteraSelectionBar` (mensajes de invalidez, limpiar) y ajuste de tests existentes de Cartera.
- Cierre: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
