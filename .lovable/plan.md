## Contexto

El bug del Tab Documentos (filas que se movían al togglear "No aplica") era causado por `jsonb_agg(to_jsonb(d.*))` sin `ORDER BY` en la RPC `get_embarque_full`. Ya quedó corregido para `documentos` y `notas` en 12.51.11.

Revisando la RPC completa y el resto del catálogo, quedan **3 agregaciones más en `get_embarque_full` sin `ORDER BY`** que sufren exactamente la misma clase de bug — el frontend renderiza esos arrays en el orden recibido, y al editar una fila puede reposicionarse:

- `conceptosVenta` → render en Tab Financiero (lista de conceptos de venta)
- `conceptosCosto` → render en Tab Financiero (lista de conceptos de costo)
- `facturas` → render en sección facturas del embarque

El resto del catálogo (`dashboard_details`, `dashboard_stats`, `operaciones_stats`, `auditoria_embarques_org`, `get_tracking_public`, `reportes_resumen`, `sincronizar_contenedores_embarque`) ya tiene `ORDER BY` en cada `jsonb_agg`. Los dos triggers (`congelar_factura_al_emitir`, `congelar_proforma_al_aprobar`) usan `jsonb_agg` para comparar snapshots, no para render, así que no aplica.

## Cambios

1. **Migración** que reemplaza `public.get_embarque_full` agregando `ORDER BY` a las tres agregaciones restantes:
   - `conceptosVenta` → `ORDER BY cv.created_at, cv.id`
   - `conceptosCosto` → `ORDER BY cc.created_at, cc.id`
   - `facturas` → `ORDER BY f.created_at, f.id`

   Resto de la función (SECURITY INVOKER implícito SQL STABLE, search_path, `documentos`/`notas` ya ordenados) se mantiene igual.

2. **`CHANGELOG.md`** — entrada 12.51.12 describiendo el fix preventivo.

3. **`src/constants/appVersion.ts`** — bump a `12.51.12`.

## Fuera de alcance

- Sin cambios en frontend (los componentes ya consumen el array en el orden recibido).
- Sin cambios en otras RPCs (ya están ordenadas o no aplican).
