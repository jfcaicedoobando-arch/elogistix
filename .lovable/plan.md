# PDF más grande en la vista previa lateral del buzón

## Problema

En `/compras/buzon`, al abrir un documento el panel lateral mide como máximo 672 px de ancho (`sm:max-w-2xl`) y el visor de PDF queda comprimido debajo de los badges, la tabla de datos y la fila de acciones. Chrome abre el PDF en modo "ajustar página" con la barra de miniaturas, así que en ese espacio pequeño el documento se ve al 25% (como se aprecia en la captura).

## Cambios propuestos

1. **Panel más ancho**: subir el ancho del panel a ~`min(1100px, 92vw)` en pantallas grandes, manteniendo pantalla completa en móvil.
2. **El PDF manda la altura**: el visor toma todo el espacio sobrante; los datos (Expediente, Folio, Archivo, Subido el) pasan a una fila compacta de 2 columnas arriba, y las acciones quedan fijas al fondo sin robar altura al PDF.
3. **Abrir el PDF ya ajustado al ancho**: añadir parámetros de vista al recurso (`#view=FitH&zoom=page-width&navpanes=0`) para que Chrome no arranque al 25% ni muestre la barra de miniaturas.
4. **Botón "Ampliar"**: un control en la cabecera del visor que abre el mismo PDF en un diálogo casi a pantalla completa (y se mantiene "Abrir en pestaña nueva" / "Descargar").
5. **Recordar preferencia**: el modo ampliado se guarda con el wrapper de storage del proyecto, para que quien revisa muchas facturas no tenga que ampliar cada vez.

## Detalles técnicos

- `src/features/bandejas/components/PreviaFacturaEntranteSheet.tsx`: ancho del `SheetContent`, layout en columna con `min-h-0` correcto y footer sticky.
- `src/features/bandejas/components/PreviaFacturaEntranteSheet.parts.tsx`: `PreviaDatos` en grid de 2 columnas; `PreviaVisor` con barra de acciones (Ampliar / pestaña nueva / descargar).
- `src/components/shared/PdfObjectViewer.tsx`: nueva prop opcional para los parámetros de vista (`#view=FitH...`) aplicados al `data` del `<object>`, reutilizable por `DocumentPreviewDialog` y `DialogPreviewCfdiPdf`.
- Preferencia de "ampliado" vía el wrapper de browser storage existente (no `localStorage` directo).
- Tests unitarios de la construcción de la URL con parámetros de vista; se mantienen los límites de 200 líneas por archivo.
- `CHANGELOG.md` + bump de `APP_VERSION` (13.388.0).

## Fuera de alcance

No se cambia cómo se descarga el archivo ni la lógica de captura/vinculación de facturas.
