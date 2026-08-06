# Factura de proveedor 066 sin XML ni PDF

## Qué encontré (verificado en la base de datos)

- La factura `FP-000066` (folio proveedor `FiscLYD-2047032`) tiene `archivo_xml_url = NULL` y `archivo_pdf_url = NULL`.
- El documento del buzón que la originó **sí tiene los dos archivos** guardados:
  - PDF: `.../FacturaNormal_2047032_ESH2311092R7.pdf`
  - XML: `.../FacturaNormal_2047032_ESH2311092R7.xml`
  - y está correctamente vinculado (`estado = capturada`, `proveedor_factura_id` = la factura 066).

Analogía: los documentos llegaron y quedaron guardados en el buzón de la entrada, pero al abrir el expediente de la factura nadie los pasó a la carpeta del expediente. El archivo existe, sólo no está referenciado desde la factura.

## Causa raíz (dos piezas)

1. La función de captura `capturar_factura_entrante` **perdió la herencia de archivos**. Una versión anterior copiaba `archivo_pdf_url`/`archivo_xml_url` del documento a la factura; la versión vigente en la base sólo marca el documento como capturado y ya no copia nada.
2. El cierre automático por UUID (`_cerrar_entrantes_por_uuid`, que dispara cuando la factura se crea con el mismo UUID fiscal) **nunca copió** esos campos.

Detalle importante: los archivos del buzón viven en el bucket `cxp-inbox`, mientras que la pestaña "Documentos" del detalle lee del bucket `facturas`. Por eso no basta con copiar el texto de la ruta: hay que copiar el objeto de un bucket al otro (o leer con respaldo desde el buzón).

## Plan de corrección

### 1. Al capturar desde el buzón, adjuntar los archivos a la factura
En el flujo de captura (`useCapturaEntranteWiring`), después de cerrar el documento:
- Descargar el PDF y el XML del buzón.
- Subirlos a `facturas/{organization_id}/cfdi/{facturaId}/...` reutilizando `subirArchivosCfdiFactura`, que además escribe `archivo_xml_url` / `archivo_pdf_url`.
- Si esa copia falla, no romper la captura: avisar con un toast de advertencia ("la factura se guardó, pero los adjuntos no se copiaron") y dejar el botón de adjuntar manual disponible.

### 2. Respaldo en la vista de Documentos (arregla 066 y las históricas)
En `DocumentosProveedorSection`: cuando `archivo_xml_url`/`archivo_pdf_url` estén vacíos, buscar el documento del buzón vinculado a la factura y ofrecer ver/descargar desde `cxp-inbox`, con la etiqueta "Documento del buzón". Así ninguna factura ya capturada queda huérfana visualmente.

### 3. Recuperación de las facturas ya capturadas
Un botón "Recuperar del buzón" en la pestaña Documentos que, para una factura con documento vinculado y campos vacíos, haga la copia descrita en el punto 1 y deje la factura normalizada. Es explícito y por factura, sin migraciones masivas de archivos.

### 4. Nota técnica
No es necesario tocar la función SQL de captura: copiar rutas del bucket equivocado dejaría enlaces roto. La copia real de objetos se hace desde el cliente, que ya tiene permisos para ambos buckets.

## Verificación
- Capturar una factura nueva desde el buzón y confirmar que la pestaña Documentos muestra XML y PDF.
- Abrir la factura 066, usar "Recuperar del buzón" y confirmar que ambos archivos abren.
- Actualizar `CHANGELOG.md` y subir `APP_VERSION`.
