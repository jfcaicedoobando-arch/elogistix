# Rediseño del modal "Capturar factura de proveedor"

Convertir el modal en un asistente de 3 pasos, con cada paso a todo el ancho para que nada se vea cortado.

## Problemas actuales (confirmados en el código)

- Las dos columnas (`lg:grid-cols-[1.15fr_1fr]`) dejan la tabla de conceptos en ~500 px, y la tabla tiene `min-w-[620px]`: siempre hay scroll horizontal y las columnas "Total línea / IVA / Total" quedan fuera de vista.
- Las descripciones de concepto usan `line-clamp-2` y `max-w-[320px]`: el texto se corta.
- Se apilan hasta 4 banners antes del formulario (documento del buzón, monto declarado, duplicado, proveedor no encontrado), empujando los campos fuera de la pantalla.
- El total aparece arriba (chip del header) y otra vez en la barra de cuadre inferior; con la descripción larga del header quedan ~500 px útiles de cuerpo.
- Orden de lectura confuso: los conceptos van a la izquierda y el proveedor/folio a la derecha, así que el dato obligatorio que bloquea el guardado queda "escondido".
- El error del folio se muestra como párrafo rojo de 4 líneas, que desplaza el resto de la columna.

## Nuevo flujo: 3 pasos

```text
Paso 1 · Documento y conceptos   Paso 2 · Datos de la factura   Paso 3 · Vincular al embarque
[carga XML/PDF o tarjeta buzón]  [proveedor + folio]            [sugerencias de operaciones]
[tabla de conceptos completa]    [fechas y crédito]             [embarques y montos]
[barra de cuadre]                [moneda, importes, T/C DOF]    [resumen final + anticipos]
                                 [categoría contable, notas]
```

- **Paso 1 — Documento y conceptos.** Origen del documento (o la tarjeta del buzón cuando ya existe), avisos del documento, tabla de conceptos a todo el ancho y barra de cuadre. Sin scroll horizontal.
- **Paso 2 — Datos de la factura.** Proveedor y folio primero (lo que más se olvida), luego fechas y crédito, moneda/importes con T/C DOF, categoría contable y notas. Dos subcolumnas sólo para campos cortos, nunca para tablas.
- **Paso 3 — Vincular al embarque.** Sugerencias heredadas de operaciones, selección de embarques con montos, aviso de anticipos y un resumen compacto (proveedor, folio, subtotal, IVA, total, moneda) para revisar antes de guardar.

## Reglas de navegación y avance

- Stepper visible arriba (ya existe `FormDialogStepper`), con los pasos clicables hacia atrás.
- Botones: `Atrás` / `Continuar` en pasos 1-2 y `Guardar factura` sólo en el paso 3.
- No se bloquea el avance de forma dura: si falta algo obligatorio del paso, se marca el campo y el paso queda con indicador de pendiente; el guardado final sigue usando la validación actual (`puedeGuardar`, tope de vinculación, CFDI duplicado).
- La lista de pendientes (`PendientesGuardarHint`) se muestra en el footer indicando en qué paso está cada faltante, con enlace para saltar ahí.
- Si el documento viene del buzón y ya trae conceptos precargados, el modal abre directo en el paso 2 (el paso 1 queda marcado como listo, revisable).
- `Ctrl/Cmd + Enter` avanza de paso y, en el paso 3, guarda.

## Anti-truncado

- Ancho del modal `4xl` → `5xl` y cuerpo de un solo flujo por paso.
- Tabla de conceptos: quitar `min-w` forzado, descripción con ancho flexible y hasta 3 líneas visibles, montos con `tabular-nums` alineados a la derecha, encabezado y fila de totales fijos al hacer scroll vertical.
- Total del header: chip compacto con desglose desplegable; se elimina la duplicidad con la barra inferior.
- Errores de campo (folio, proveedor, T/C) como mensaje corto de una línea bajo el input, con el detalle largo en tooltip accesible (`Hint`).
- Banners: sólo el relevante al paso actual; los informativos se consolidan en una sola tarjeta del documento.
- La descripción del header se acorta y deja de mencionar el XML cuando el documento ya está cargado.

## Detalles técnicos

- `DialogNuevaFacturaProveedor.tsx`: agrega estado de paso y arma el `stepper` de `FormDialogShell`; el footer se vuelve un componente propio (`CapturaFacturaFooter`) con la lógica de Atrás/Continuar/Guardar.
- Nuevo `_sections/PasoDocumento.tsx`, `_sections/PasoDatos.tsx`, `_sections/PasoVinculacion.tsx` reutilizando los bloques existentes (`CargaCfdiSection`, `CfdiConceptosPreview`, `ConceptosManualesSection`, `FacturaProveedorFormFields`, `FechasEImportesBlock`, `VincularEmbarqueSection`). Se retiran `DialogNuevaFacturaProveedor.columnas.tsx` / `.datos.tsx`.
- Nuevo hook `useCapturaFacturaPasos.ts`: paso activo, paso inicial según modo buzón, pendientes por paso derivados de `ctl.values`/`ctl.errors` y salto a paso.
- Sin cambios de lógica de negocio, cálculo, validación de servidor ni RPCs: sólo presentación y navegación.
- Tokens semánticos existentes, `FormSection`, `Hint` y `text-body*`; archivos ≤ 200 líneas (Power of 10).
- Tests: se actualiza `capturaFacturaModalUi.test.tsx` y se añaden casos de navegación entre pasos, arranque en paso 2 en modo buzón y visibilidad del botón Guardar sólo en el paso 3.
- `CHANGELOG.md` + bump de `APP_VERSION` (minor).
