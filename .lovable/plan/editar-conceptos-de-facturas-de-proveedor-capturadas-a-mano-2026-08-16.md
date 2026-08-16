# Editar conceptos de facturas de proveedor capturadas a mano

## Regla de negocio

Los conceptos siguen siendo **inmutables** cuando la factura viene de un CFDI (tiene XML o UUID fiscal): ese desglose es el "ticket original" ante el SAT y sólo cambia recargando el XML.

Se habilita edición **sólo** cuando se cumple todo:

- La factura **no** tiene XML ni UUID fiscal (captura manual o extracción de PDF sin XML).
- **No** tiene pagos aplicados.
- **No** está cancelada.
- Si estaba **aprobada**, al guardar vuelve a **Por aprobar** (mismo criterio que ya usa "Editar factura" con importes).

Todo cambio queda en la bitácora del documento (quién, cuándo, cuántas líneas antes/después).

## Qué verá el usuario

En la pestaña **Conceptos** del detalle de la factura de proveedor:

- Botón **Editar conceptos** en el encabezado de la sección.
  - Si la factura tiene CFDI, pagos o está cancelada, el botón aparece deshabilitado con una explicación breve del motivo ("Los conceptos vienen del XML del proveedor", "La factura ya tiene pagos registrados", etc.).
- El botón abre un modal (`FormDialogShell`) con la misma captura de partidas que ya existe al crear la factura: descripción, cantidad, importe unitario, IVA, IEPS; agregar y eliminar renglones.
- Debajo, la barra de cuadre existente: si la suma de líneas no coincide con el subtotal de la factura, se avisa la diferencia (no se bloquea el guardado si el usuario confirma, pero se resalta el renglón sospechoso, igual que en la captura).
- Al guardar, el resumen tipo invoice de la sección se recalcula al instante.

## Detalle técnico

**Base de datos** (una migración):

- RPC `public.reemplazar_conceptos_factura_proveedor(p_factura_id uuid, p_conceptos jsonb)`, `SECURITY DEFINER`, `search_path = public`, sin `EXECUTE` para `anon`:
  - Valida tenant con el patrón vigente (`rls_tenant_scope_ok` / `_assert_writer`).
  - Rechaza con `LC_CONCEPTOS_FISCALES` si `archivo_xml_url` o `uuid_fiscal` no son nulos.
  - Rechaza con `LC_FACTURA_CON_PAGOS` si hay pagos vivos, y `LC_FACTURA_CANCELADA` si está cancelada.
  - Borra e inserta atómicamente las filas de `proveedor_facturas_conceptos` con `concepto_costo_id IS NULL` (no toca las filas de vinculación a costos del embarque).
  - Si `estado_aprobacion = 'aprobada'`, la regresa a `'pendiente'` y limpia `aprobada_por` / `aprobada_at`.

**Frontend**:

- `src/features/cxp/services/conceptosCfdiFactura.ts`: nueva función `reemplazarConceptosFactura()` que llama la RPC y registra bitácora (`accion: "editar_conceptos"`).
- Nuevo `src/features/cxp/hooks/useEditarConceptosFactura.ts` (mutación + invalidación de `queryKeys.cxp.conceptosCfdi` y del detalle).
- Nuevo `src/features/cxp/components/DialogEditarConceptosFactura.tsx`, reutilizando `ConceptosManualesSection` y `useConceptosManuales` para no duplicar la captura.
- Nuevo helper de elegibilidad `src/features/cxp/utils/conceptosEditables.ts` (`motivoNoEditable(factura)`), consumido por la sección para el estado del botón.
- `ConceptosFacturaSection.tsx`: recibe la factura (o los flags necesarios) y monta el botón + diálogo, manteniéndose bajo 200 líneas.

**Pruebas**:

- Unitarias de `motivoNoEditable` (CFDI, pagos, cancelada, editable).
- Unitaria del servicio: shape enviado a la RPC y propagación de errores `LC_*`.
- SQL en `supabase/tests/` que confirme el rechazo con XML/pagos y el reemplazo correcto en el caso manual.

`CHANGELOG.md` + bump de `APP_VERSION` (menor).
