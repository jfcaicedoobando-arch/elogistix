## Cómo editar los conceptos hoy (sin cambios)

Analogía: piensa en la factura como una **hoja de Excel impresa**. La carta de arriba, **"Editar conceptos del borrador"**, es tu hoja de Excel en pantalla — puedes modificar celdas. La carta de abajo, **"Desglose de conceptos"**, es la vista previa impresa — sólo para leer. Como estás en un **borrador**, ambas muestran lo mismo.

Para corregir un concepto:

1. Ve a la carta **"Editar conceptos del borrador"** (la de arriba).
2. En el renglón que quieras cambiar, haz clic en el **ícono de lápiz** (a la derecha del renglón).
3. Edita descripción, cantidad, precio, IVA o retenciones.
4. Confirma con el ícono de **✓** (check). Si te arrepientes, la **X** cancela.
5. Para borrar un renglón usa el **bote de basura**. Para agregar uno nuevo usa el botón **"+ Agregar"** arriba a la derecha.

Los totales (subtotal, IVA, total) se recalculan solos al guardar.

## Diagnóstico UX

Sí hay un problema real: cuando la factura está en **borrador**, las dos cartas muestran **exactamente los mismos renglones**. Eso genera la duda "¿cuál edito?". La segunda carta sólo aporta valor cuando la factura ya está **timbrada** (ahí el editor desaparece y "Desglose" muestra el snapshot inmutable de Facturapi).

## Cambio propuesto en la app

Ocultar la carta **"Desglose de conceptos"** cuando el editor está visible, porque muestran los mismos datos y confunde. Cuando la factura se timbre, el editor desaparece y el "Desglose" vuelve a mostrarse automáticamente (ya con el snapshot fiscal).

**Archivo a tocar:** `src/features/facturacion/routes/FacturaDetalle.tsx` (líneas 128-139).

**Cambio:** envolver `<FacturaConceptosTable ...>` en `{!puedeEditarBorrador && (...)}`. Una sola línea de condición, sin lógica nueva.

**Detalles técnicos**

- `puedeEditarBorrador` ya se calcula en el detalle y es la misma bandera que usa `FacturaDetalleEditableSections` para renderizar el editor. Reutilizamos exactamente esa condición → cero riesgo de estados intermedios.
- No hay pérdida de información: el editor ya muestra descripción, cantidad, precio, importe, IVA y retenciones por renglón, más los mismos badges de régimen de IVA.
- Bump `APP_VERSION` a `13.300.53` + entrada en `CHANGELOG.md`.
- No requiere migración ni cambios en servicios/hooks.

**Qué podría romperse:** nada funcional. El único efecto secundario es visual — los usuarios acostumbrados a ver dos cartas verán sólo una mientras el CFDI esté en borrador. Es el resultado deseado.

En la carta de Editar conceptos, no se precargaron los datos de la factura original para que la edición sea sencilla. Corrije esto. 