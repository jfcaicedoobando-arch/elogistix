# Elegir el proveedor al subir la factura al buzón

Hoy el modal "Subir factura de proveedor al buzón" sólo adivina el proveedor leyendo el RFC del XML. Si no hay XML (proveedor extranjero) o el RFC no coincide con ningún proveedor dado de alta, el documento llega al buzón sin proveedor y contabilidad tiene que investigarlo.

## Qué se va a construir

Un selector de proveedor dentro del modal, con esta lógica:

1. **Proveedores del embarque primero.** Se listan arriba los proveedores que ya aparecen en los costos del embarque (los capturados en la pestaña Costos), que es lo que el operador reconoce.
2. **Buscador del resto.** Debajo, un buscador para elegir cualquier proveedor de la organización, por si la factura es de alguien que aún no está en los costos.
3. **Sugerencia automática.** Si el XML trae un RFC que empata con un proveedor, ese queda preseleccionado y marcado como "detectado del CFDI". El operador puede cambiarlo.
4. **Opción "Aún no lo sé".** Se puede dejar sin proveedor (comportamiento actual) para no bloquear la subida.
5. **Aviso de discrepancia.** Si el operador elige un proveedor distinto al detectado por RFC, se muestra una advertencia clara (no bloquea, sólo avisa).

El valor elegido se guarda en el documento del buzón, igual que hoy, para que al capturar la factura desde el buzón el proveedor venga prellenado y para poder ligar PDF y XML al proveedor.

## Detalles técnicos

- **Datos**: la columna `proveedor_id` ya existe en `embarque_facturas_entrantes` y ya se envía en `subirFacturaEntrante`; no hace falta migración.
- **Nuevo hook** `useProveedoresDelEmbarque(embarqueId)`: consulta `conceptos_costo` vivos del embarque (`deleted_at is null`) y devuelve la lista única de `proveedor_id` + nombre, ordenada por nombre.
- **Nuevo componente** `SelectorProveedorEntrante.tsx` (en `src/features/embarques/components/entrantes/`): Popover + `Command` (patrón ya usado en la app) con dos grupos, "Del embarque" y "Todos los proveedores" (este último alimentado por `embarqueQueries.proveedoresSelect`), más la opción de limpiar.
- **`useSubirEntranteForm`**: se añade `setProveedor` manual y una bandera `proveedorDetectadoId` para distinguir la sugerencia por RFC de la elección del operador; al quitar el XML ya no se borra la elección manual.
- **`CfdiMetaPreview`**: deja de ser la única fuente de verdad del proveedor; muestra el RFC leído y la advertencia de discrepancia contra el proveedor seleccionado.
- **`SubirFacturaEntranteDialog`**: nueva sección "Proveedor" entre "Archivos" y "Nota". Se mantiene el límite de 200 líneas por archivo extrayendo el selector a su propio componente.
- **Tests**: unitarios del hook de proveedores del embarque (dedupe/orden) y de la lógica de discrepancia RFC vs. selección; test de render del selector con grupos.
- Se registra el cambio en `CHANGELOG.md` y se sube `APP_VERSION`.

## Fuera de alcance

- No se cambia el flujo de captura contable desde el buzón (ya hereda `proveedor_id`).
- No se hace obligatorio el proveedor para poder subir el documento.
