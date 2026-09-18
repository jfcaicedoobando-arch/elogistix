# Arreglar "conceptos_query_failed" al timbrar

## Qué pasó

En el lote anterior agregué el campo `aplica_iva` a la lectura de los conceptos de la factura, dando por hecho que existía en esa tabla. No existe: consulté la base y las columnas de `conceptos_factura` son `tipo_iva`, `tasa_iva_aplicada`, `tasa_ret_isr`, `tasa_ret_iva`, `monto_ret_isr`, `monto_ret_iva` (más las de siempre). `aplica_iva` sí existe, pero en los conceptos de venta y de proforma, no en los de factura.

Resultado: la consulta previa al timbrado falla y toda factura queda con "No se pudo timbrar · conceptos_query_failed". Es un bloqueo total del timbrado en la versión 13.824.1, no un caso aislado de la factura de Karol.

## Qué haré

1. Quitar `aplica_iva` de la lectura de conceptos de factura y del chequeo de coherencia de ese flujo. En los conceptos de factura el tratamiento fiscal queda determinado por `tipo_iva` + `tasa_iva_aplicada`, que ya se validan y bloquean cuando se contradicen.
2. Dejar constancia en el código de que en esta tabla no hay interruptor legado, para que nadie lo vuelva a agregar.
3. Ampliar la auditoría automática de columnas para que también revise las funciones del servidor y las listas de campos que se piden, no sólo los filtros. Así un campo inexistente se detecta antes de llegar a producción. Si al ampliarla aparecen desajustes previos, los reporto en el resumen; no los silencio ni bajo el umbral.
4. Pruebas: una que confirme que la lectura de conceptos sólo pide columnas que existen, y ajuste de la prueba del lote anterior que esperaba el campo eliminado.
5. Validar con pruebas del servidor y de facturación, tipos, estilo y compilación; subir versión y changelog.

No toco tratamientos fiscales, ni el cuadre de totales, ni la regla de Método/Forma de pago, ni el realineo de fecha del timbre. No se publica.

## Detalles técnicos

- `supabase/functions/facturapi-emitir/contexto.ts`: sacar `aplica_iva` del `.select()` (línea 72), de `ConceptoRow` (líneas 18-24) y del objeto que se pasa a `clasificarCoherenciaIva` (línea 111). `_shared/coherenciaIva.ts` conserva el soporte del campo porque otros consumidores (conceptos de venta/proforma) sí lo tienen.
- `supabase/functions/facturapi-emitir/contexto_test.ts`: quitar la expectativa de `aplica_iva` y agregar un caso que valide la lista de columnas del `select` contra las reales de `conceptos_factura`.
- `scripts/audit-schema-columns.ts`: incluir `supabase/functions/**/*.ts` en los globs y, además de `.is("col", …)`, verificar los identificadores dentro de `.select("a, b, c")` contra `types.ts`. Mantener exclusión de pruebas.
- Versión: `APP_VERSION` a `13.824.2` + entrada en `CHANGELOG.md` con la causa (columna inexistente) y el alcance del guard nuevo.
