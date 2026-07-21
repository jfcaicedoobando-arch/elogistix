## Problema

En el modal **Capturar factura de proveedor**, el dropdown de proveedor (`ProveedorCombobox`) muestra la lista con `max-h-[300px] overflow-y-auto`, pero la rueda del mouse no la hace scrollear. Los clics sí funcionan (se puede seleccionar un proveedor), así que no es un tema de `pointer-events`.

La causa más probable es interferencia entre el `Popover` (renderizado en portal) y el `Dialog` modal padre: el evento `wheel` se propaga al contenedor del Dialog, que aplica scroll-lock/overflow-hidden y "come" la rueda antes de que la lista `cmdk` la procese. Es un patrón conocido con `cmdk` + `Popover` dentro de `Dialog`.

## Cambio propuesto

Fix quirúrgico en un solo archivo, sin tocar business logic:

**`src/features/cxp/components/ProveedorCombobox.tsx`**
- Agregar `onWheel={(e) => e.stopPropagation()}` sobre `<CommandList>` para que la rueda se consuma dentro de la lista scrollable en vez de burbujear al Dialog.
- Opcional (defensivo): añadir `className="overscroll-contain"` para evitar que, al llegar al tope/fondo, el scroll salte al fondo del Dialog.

## Verificación

- Reproducir en `/compras/facturas` → botón **Capturar factura** → abrir el combobox de proveedor → usar la rueda del mouse sobre la lista y confirmar que scrollea.
- Confirmar que la selección con clic y la búsqueda por teclado siguen funcionando.

## Versionado

- `APP_VERSION` → `13.303.90`.
- Entrada nueva en `CHANGELOG.md` con analogía corta.

## Analogía (para el resumen final)

El `Dialog` modal es como una sala con puertas cerradas: los clics entran porque el Popover tiene su propio pase, pero el "empujón" de la rueda del mouse se lo quedaba la puerta del Dialog antes de llegar a la lista. Con `stopPropagation` la lista atrapa la rueda primero y por fin se puede scrollear.
