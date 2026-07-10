## Diagnóstico

Alan editó el embarque **ELIMP00245** tres veces (20:37, 20:38, 20:39). Cada intento agregó un concepto de **Demoras** (venta 360 USD / costo 320 USD). La bitácora dice "agregado" cada vez, pero al volver a abrir el embarque los nuevos conceptos no aparecen.

Consultando la BD sin filtros:

```
conceptos_venta  Demoras 360  created_at = 20:37:16.778  deleted_at = 20:37:16.778
conceptos_venta  Demoras 360  created_at = 20:38:16.437  deleted_at = 20:38:16.437
conceptos_venta  Demoras 360  created_at = 20:39:49.245  deleted_at = 20:39:49.245
conceptos_costo  Demoras 320  created_at = 20:37:16.778  deleted_at = 20:37:16.778
... (mismo patrón)
```

`created_at == deleted_at` en cada fila: el mismo RPC que las inserta las marca como borradas en la misma llamada.

## Causa raíz

RPC `public.actualizar_embarque_completo`:

1. Arma `v_incoming_venta_ids` / `v_incoming_costo_ids` **solo con los `id` que vienen en el payload**.
2. Recorre el payload: los conceptos con `id` se hacen UPDATE; los que no traen `id` (nuevos) se INSERT y guardan su id en `v_new_id`.
3. Al final ejecuta un soft-delete: `UPDATE ... SET deleted_at = now() WHERE ... AND NOT (id = ANY(v_incoming_venta_ids))`.

Como el `id` recién generado por el INSERT **nunca se agrega a `v_incoming_*_ids`**, el soft-delete al final lo alcanza y lo mata en la misma transacción. Analogía: firmas un contrato nuevo y en el último párrafo dice "cualquier contrato que no esté en esta lista queda cancelado" — pero la lista se hizo antes de firmar, así que tu propio contrato queda cancelado.

Los conceptos "Flete Marítimo" y "Cargos en Destino" originales sí sobreviven porque están facturados (`estado_facturacion='facturado'`, `proforma_id` no nulo) y el soft-delete solo toca los `pendiente` sin proforma. Por eso el bug pasó desapercibido: solo se manifiesta al **agregar conceptos nuevos** (que es exactamente lo que hacía Alan con Demoras).

## Cambios

### 1. Migración: parchar el RPC

Reescribir `actualizar_embarque_completo` para que el INSERT de conceptos nuevos agregue el id generado al array de "sobrevivientes" antes del soft-delete. En pseudo-SQL:

```sql
-- rama INSERT venta
INSERT INTO conceptos_venta (...) VALUES (...) RETURNING id INTO v_new_id;
v_incoming_venta_ids := array_append(v_incoming_venta_ids, v_new_id);

-- rama INSERT costo (equivalente)
INSERT INTO conceptos_costo (...) VALUES (...) RETURNING id INTO v_new_id;
v_incoming_costo_ids := array_append(v_incoming_costo_ids, v_new_id);
```

El resto del RPC queda intacto. Al ser SECURITY DEFINER + idempotency_claim, no hay riesgo de re-ejecutar migraciones anteriores.

### 2. Rescatar los conceptos "Demoras" perdidos de ELIMP00245

Alan hizo 3 intentos idénticos. Restaurar **solo el último** (20:39:49) poniendo `deleted_at = NULL` en las 2 filas de esa marca de tiempo (una en `conceptos_venta`, una en `conceptos_costo`). Descartar los 2 duplicados anteriores.

### 3. CHANGELOG + APP_VERSION

- Bump a `13.252.2` (patch).
- Entrada breve: "Fix: nuevos conceptos de venta/costo agregados al editar un embarque se guardan correctamente (el RPC los borraba en la misma transacción)."

### 4. Test (opcional pero recomendado)

Agregar un test SQL en `supabase/tests/rls/` o pgtap equivalente que:
1. Cree un embarque.
2. Llame `actualizar_embarque_completo` con un concepto sin `id`.
3. Verifique que el concepto queda con `deleted_at IS NULL`.

Esto es el "canario" que evita que el bug vuelva.

## Resumen para el usuario

El sistema tenía un error tipo "lista de invitados": al guardar el embarque, primero apuntaba qué conceptos debían quedarse (los que ya tenían identificador), luego creaba los nuevos, y al final borraba "todo lo que no estaba en la lista" — pero los recién creados nunca se agregaron a esa lista, así que se auto-borraban. Se corrige agregando cada concepto nuevo a la lista de sobrevivientes justo después de crearlo, y se restaura manualmente el último "Demoras" que Alan intentó guardar en el embarque 245.
