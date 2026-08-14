# Conceptos de factura con formato de invoice

## Lo que hay hoy

La pestaña **Conceptos** del detalle de factura de proveedor muestra una tabla con: `#`, Descripción, Cant., Importe unit., Total línea, IVA (y IEPS sólo si existe), y un pie con la suma de Total línea + IVA.

Le faltan tres cosas para leerse como una factura normal:

1. No hay columna de **total de la línea con impuestos** (Total línea + IVA + IEPS). El ojo tiene que sumar mentalmente.
2. El pie sólo suma dos columnas; no existe el **resumen de totales** típico (Subtotal → IVA → IEPS → Retenciones → **TOTAL**) que sí vive escondido en la pestaña "Proveedor y datos fiscales".
3. Las descripciones largas se cortan con puntos suspensivos, lo que refuerza la sensación de "incompleto".

## Qué voy a cambiar (sólo presentación)

En la sección de conceptos del detalle de factura de proveedor:

- **Nueva columna "Total"** al final de cada línea: total línea + IVA + IEPS, en negritas, como cierre natural de la fila.
- **Pie de tabla completo**: la fila de totales suma todas las columnas numéricas, incluida la nueva.
- **Bloque de resumen tipo invoice** debajo de la tabla, alineado a la derecha (mismo patrón visual que la caja de totales de los PDF):
  - Subtotal (suma de conceptos)
  - IVA
  - IEPS (sólo si hay)
  - Retenciones (en negativo, sólo si hay)
  - **TOTAL** destacado, en la moneda del documento
  - Si el total de la factura no coincide con lo que suman los conceptos (CFDI con descuentos o conceptos incompletos), se muestra una línea de aviso discreta con la diferencia, en lugar de fingir que cuadra.
- **Descripciones**: dejan de truncarse a una línea; se permiten hasta dos líneas con salto, conservando el tooltip.
- Se aplica el mismo tratamiento a la vista previa de conceptos del CFDI en la captura, para que ambas pantallas se vean iguales.

Sin cambios en datos, RPCs ni cálculos de negocio: los importes salen de los mismos valores del CFDI ya guardados.

## Detalle técnico

- `src/features/cxp/components/ConceptosFacturaSection.tsx`: nueva columna Total por línea, `tfoot` completo y nuevo bloque de resumen.
- Nuevo `src/features/cxp/components/ConceptosTotalesResumen.tsx` (resumen reutilizable) para mantener ambos archivos bajo 200 líneas.
- `src/features/cxp/components/CfdiConceptosPreview.tsx`: reutiliza la misma columna Total y el resumen.
- Los totales de línea siguen usando `totalLinea`/`sumarConceptos` de `cuadreConceptos.ts` (currency.js) para no introducir drift; el resumen recibe subtotal/IVA/retenciones/total desde la factura.
- Prueba unitaria del cálculo del resumen (suma con IEPS y con retenciones, y detección de descuadre).
- `CHANGELOG.md` + `APP_VERSION` (bump menor).
