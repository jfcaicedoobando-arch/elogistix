# Mostrar el nombre completo de proveedores y clientes en los selectores

## Problema confirmado

El nombre no se corta por el ancho del campo: el código **borra palabras a propósito** antes de mostrarlas.

En el selector de proveedor de los conceptos de costo (wizard de nuevo/editar embarque) se muestra sólo las **2 primeras palabras** del nombre:

`src/features/embarques/components/conceptos/FilaCostoPrecio.tsx` (línea 41)
`{p.nombre.split(' ').slice(0, 2).join(' ')}`

Por eso "COSCO SHIPPING LINES MÉXICO ..." aparece como "COSCO SHIPPING", y dos proveedores distintos que empiezan igual se vuelven indistinguibles.

El mismo recorte (3 primeras palabras) existe en los filtros de cliente de otros 4 módulos:

- `src/features/embarques/components/EmbarquesFiltros.tsx` (109)
- `src/features/cotizacion/components/CotizacionesFilterSelects.tsx` (32)
- `src/features/facturacion/components/TabFacturasEmitidas.tsx` (100)
- `src/features/facturacion/components/ProformasFiltrosCampos.tsx` (63)

## Qué se va a cambiar

1. **Lista desplegable: nombre completo, siempre.** Se elimina el recorte por palabras en los 5 archivos y se pasa el nombre íntegro a cada opción.
2. **La lista puede ser más ancha que el campo.** El desplegable crece hasta lo que necesite (con un tope razonable) en lugar de quedar amarrado al ancho del campo, y si un nombre aún no cabe se muestra en dos líneas en vez de cortarse.
3. **Campo cerrado: recorte visual con "…" y tooltip nativo.** Cuando el nombre elegido no cabe en el campo cerrado se recorta con puntos suspensivos, pero al pasar el mouse se ve el nombre completo (atributo `title`). Nada de palabras eliminadas del dato.

## Detalle técnico

- `src/components/ui/select.tsx`:
  - `SelectContent`: la clase del `Viewport` deja de forzar `w-full` sobre el ancho del trigger; se conserva `min-w-[var(--radix-select-trigger-width)]` y se añade un `max-w` (p. ej. `max-w-[min(90vw,32rem)]`) para que el menú se ensanche sin desbordar la pantalla.
  - `SelectItem`: se permite salto de línea (`whitespace-normal break-words leading-snug`) para nombres muy largos.
  - `SelectTrigger`: se mantiene `[&>span]:line-clamp-1` (recorte visual del valor seleccionado).
- Los 5 archivos listados: se sustituye `nombre.split(" ").slice(0, N).join(" ")` por `nombre`, y en el `SelectTrigger` correspondiente se añade `title` con el nombre completo del elemento seleccionado donde el patrón lo permita sin refactorizar el componente.
- Sin cambios de base de datos ni de lógica de negocio: sólo presentación.
- Se registra la entrada en `CHANGELOG.md` y se sube `APP_VERSION` (patch).
