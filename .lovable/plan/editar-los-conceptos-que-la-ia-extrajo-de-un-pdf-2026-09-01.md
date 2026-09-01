# Editar los conceptos que la IA extrajo de un PDF

## Cómo se hace hoy (sin cambios de código)

Durante el asistente de captura, la tabla "Conceptos" que llena la IA es **sólo lectura**: no se pueden borrar los renglones de más antes de guardar.

Una vez guardada la factura sí se pueden corregir:

1. Compras → Facturas de proveedor → abrir la factura.
2. Sección "Conceptos de la factura" → botón **Editar conceptos**.
3. Borrar los renglones sobrantes y guardar.

Ese botón funciona para facturas cargadas por PDF con IA (no traen XML ni UUID del SAT), siempre que la factura no esté cancelada ni tenga pagos aplicados. Si tiene pagos, primero hay que eliminar el pago.

## Mejora propuesta (pulido, sin features nuevas)

Permitir borrar/corregir los renglones extraídos por IA **antes** de guardar, para no tener que guardar mal y corregir después.

- En el paso 1 del asistente, cuando el origen es "PDF con IA", la tabla de conceptos deja de ser sólo lectura: cada renglón obtiene un botón de eliminar y los campos de descripción, cantidad, importe e IVA se vuelven editables.
- Cuando el origen es XML CFDI, la tabla **sigue siendo sólo lectura**: ese desglose es fiscal y debe reflejar fielmente al SAT.
- La barra de cuadre (suma de conceptos vs. subtotal capturado) se recalcula al editar, así que si borras un renglón de más el aviso te dirá si el subtotal ya no coincide y podrás ajustarlo.

## Detalles técnicos

- Estado: `cfdiConceptos` en `useNuevaFacturaProveedorForm.ts` pasa a exponer `editarConcepto(idx, patch)` y `eliminarConcepto(idx)`.
- UI: `CfdiConceptosPreview.tsx` recibe prop opcional `onEditar` / `onEliminar`; sólo se pasa cuando `pendingCfdi.origen === "pdf_ia"`. Renglones editables reutilizando los inputs de `ConceptoLineaRow`.
- Persistencia: no cambia. `conceptosAPersistir` ya guarda el arreglo en memoria en `proveedor_facturas_conceptos`; no se tocan RPCs ni la base de datos.
- Sin cambios en `evaluarEdicionConceptos` ni en la RPC `reemplazar_conceptos_factura_proveedor`.
- Pruebas: unitarias del reducer de conceptos (editar/eliminar y recálculo del cuadre) y del bloqueo de edición cuando el origen es CFDI.
