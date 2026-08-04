# Arreglo: "Factura duplicada" al capturar desde el Buzón

## Qué pasó (verificado en datos)

Al guardar la factura, el sistema encontró que ya existe una factura viva con el mismo proveedor + folio + fecha:

- `FP-000048` — proveedor HK LS LIMITED, folio `DEBIT260676140`, fecha 2026-06-15, USD 4,703, capturada el 22/07/2026 desde PDF con IA, archivo real `NQDEC260544571_DN_...pdf`.

Dos hallazgos confirmados al revisar los datos:

1. **El folio que guarda la IA no es el número real del documento.** En todas las facturas capturadas con IA el archivo se llama `NQDEC2605...`, `NNBEC2605...`, `NTJEC2605...`, pero el folio guardado es del tipo `DEBIT2606...`. Es un número inventado/derivado por la IA, no el folio impreso. Como todos siguen el mismo patrón, dos notas de débito distintas del mismo proveedor pueden terminar con el mismo folio y chocar como si fueran duplicadas. (Analogía: es como si al archivar recibos les pusiéramos una etiqueta genérica en lugar del número que trae el papel — tarde o temprano dos etiquetas se repiten.)
2. **El aviso de duplicado es un callejón sin salida.** El toast dice "Ya capturaste el folio X…" pero no dice *cuál* factura es, no lleva a ella y no ofrece corregir el folio. El aviso equivalente de CFDI duplicado sí trae botón "Ver factura".
3. **El buzón guarda documentos repetidos.** Hay pares del mismo archivo subidos con segundos de diferencia en el mismo embarque (p. ej. `COSU6502152870 Debit Note(英文).pdf` dos veces). Cuando uno se captura, el gemelo queda "por capturar" y al intentarlo revienta con duplicado.

## Qué se va a hacer

### 1. Aviso de duplicado con salida (frontend)
- El aviso mostrará el folio interno, estado y fecha de la factura existente, con botón **"Ver factura"** que abre su detalle.
- Se marcará el campo Folio con el error y un texto de ayuda: "Si es un documento distinto, corrige el folio o la fecha de emisión".
- Si el documento viene del buzón, se añade la acción **"Vincular a la factura existente"** para cerrar el pendiente del buzón sin capturar de nuevo.

### 2. Folio confiable en la extracción con IA (backend)
- Ajustar las instrucciones de extracción para que el folio sea **textualmente** el que aparece impreso en el documento (Invoice No. / Debit Note No. / Bill No.), prohibiendo construirlo o inferirlo; si no aparece, devolverlo vacío.
- Si el folio llega vacío o poco confiable, el formulario lo deja en blanco, resalta el campo y pide capturarlo a mano en lugar de guardar un número inventado.
- Sugerencia visible del número detectado en el nombre del archivo como apoyo.

### 3. Evitar documentos repetidos en el buzón
- Al subir, si ya existe un documento con el mismo nombre y tamaño en el mismo embarque y sigue "por capturar", se avisa y no se crea el duplicado.
- Si el gemelo ya fue capturado, se ofrece marcarlo como capturado/vinculado en lugar de abrir captura nueva.

### 4. Datos existentes
- No se tocan las facturas ya capturadas (los folios `DEBIT…` se quedan; corregirlos es edición manual factura por factura). Sí se listarán para que puedas revisarlas si lo deseas.

## Detalles técnicos

- `useNuevaFacturaProveedorForm.submit.ts`: la rama `..._DUP` pasará a usar el mismo patrón que `notificarCfdiDuplicado` (descripción + `accionVerFactura`); `existeFacturaDuplicada` devolverá la fila (id, `folio_interno`, estado) en vez de un booleano, y se ajustará su uso en `proveedorFacturas.update.ts`.
- `supabase/functions/parse-invoice-pdf/extract.ts`: endurecer la descripción de `invoice_number` en el tool-schema y quitar cualquier relleno en `normalize`; añadir bandera `folio_confianza` para que el frontend decida si precargar.
- Dedupe de buzón en el servicio de subida de `embarque_facturas_entrantes` (consulta previa por `embarque_id` + `nombre_archivo` + `estado='por_capturar'`).
- Tests: unitario del nuevo retorno de `existeFacturaDuplicada`, del mapeo IA sin folio, y del dedupe de buzón.
- `CHANGELOG.md` + bump de `APP_VERSION`.
