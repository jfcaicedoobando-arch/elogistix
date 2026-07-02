
## Objetivo

Cerrar la brecha del flujo de rechazo de proformas: hoy el rechazo solo cambia un estado, pero los conceptos siguen amarrados y el operador nunca se entera dentro del embarque. Después de este cambio, un rechazo (portal o manual) libera los conceptos, actualiza el embarque y muestra un aviso claro para regenerar la proforma.

## Comportamiento nuevo al rechazar

Cuando `estado_cliente` pasa a `'rechazada'` (por portal o por dialog manual):

1. **Proforma:** se marca como rechazada con `rechazada_at`, `motivo_rechazo` y `aceptada_por` (origen). Se **congela** para edición pero se **conserva como registro histórico** (visible con badge rojo "Rechazada por cliente" + motivo en el detalle).
2. **Conceptos:** todos los `conceptos_venta` con `proforma_id = <esta>` se liberan:
   - `proforma_id → NULL`
   - `estado_facturacion → 'pendiente'`
3. **Embarque:** se recalcula `embarques.tiene_proforma` (true solo si queda otra proforma viva).
4. **Bitácora + notificaciones:** ya existen; se enriquecen con la cuenta de conceptos liberados.

## Cambios técnicos

### 1. Base de datos (migración)

**Función helper `liberar_conceptos_de_proforma(p_proforma_id uuid)`** (SECURITY DEFINER):
- Actualiza `conceptos_venta` (`proforma_id=NULL`, `estado_facturacion='pendiente'`) para la proforma dada.
- Recalcula `embarques.tiene_proforma` para el embarque asociado.
- Retorna `int` con la cantidad de conceptos liberados.

**Extender las 2 RPCs de respuesta** para llamar a la helper cuando la respuesta sea `rechazada`:
- `actualizar_estado_cliente_proforma` (manual)
- `portal_responder_por_token` (portal público)

Ambas escriben la cuenta de conceptos liberados en el JSON de bitácora y en el mensaje de notificación interna.

**Trigger anti-rechazo-post-facturación:** el trigger `trg_enforce_proforma_aceptada` ya bloquea facturar sin aceptación; agregar validación adicional en las RPCs para que no se pueda pasar a `rechazada` si `estado_proforma = 'facturada'` (con mensaje claro).

### 2. Frontend — detalle de proforma

`ProformaDetalleCards.tsx`:
- Cuando `estado_cliente = 'rechazada'`: mostrar tarjeta destacada roja con `motivo_rechazo`, fecha de rechazo, y origen (portal/manual/histórica) — reutilizando la lógica de origen ya existente.
- La sección de conceptos ya no permitirá "Convertir a factura" (el gate actual ya lo bloquea).

### 3. Frontend — detalle del embarque (tab Facturación)

Nuevo componente `AvisoProformasRechazadas` en `src/features/embarques/components/`:
- Lee las proformas del embarque con `estado_cliente = 'rechazada'` en las últimas 30 días.
- Muestra `Alert` variant destructiva con: número de proforma, fecha, motivo, cliente.
- Botón "Generar nueva proforma" que abre el wizard existente con los conceptos ya liberados pre-seleccionados.
- Se inserta en la parte superior del tab Facturación, arriba del listado de conceptos.

### 4. Feedback al usuario

En el dialog manual (`RespuestaClienteManualDialog`): al confirmar rechazo, además del toast actual mostrar la cantidad de conceptos liberados: `"Proforma PRO-XXXX rechazada. Se liberaron N conceptos para regenerar."` (usando `sonner` `toast.success`).

### 5. Retrocompatibilidad con proformas rechazadas existentes

Migración one-shot: para proformas ya rechazadas antes de este cambio (`estado_cliente='rechazada'` pero con conceptos aún amarrados), ejecutar `liberar_conceptos_de_proforma` una sola vez. Diagnóstico previo con `SELECT COUNT(*)` antes de correr para reportar el impacto.

### 6. Tests

- Unit test del helper `liberar_conceptos_de_proforma` (migración de fixture).
- Integration test en `respuestaCliente.test.ts` que verifica que después de rechazar, los conceptos quedan con `proforma_id=null`.
- Architecture test: verificar que el trigger de `tiene_proforma` refleje el estado correcto.

### 7. Versionado

Bump a `13.145.0` (minor: cambio de comportamiento del flujo de rechazo) + entrada detallada en `CHANGELOG.md`.

## Fuera de alcance

- No se elimina ni archiva la proforma rechazada (se conserva como histórico).
- No se toca el flujo de aceptación (ese sigue igual).
- No se agrega un botón de "Re-abrir" para pasar de `rechazada` a `pendiente` — si el cliente cambia de opinión, el equipo debe generar una nueva proforma.

## Diagrama del flujo

```text
Cliente/Admin rechaza
        │
        ▼
RPC (portal_responder_por_token | actualizar_estado_cliente_proforma)
        │
        ├─► UPDATE proformas SET estado_cliente='rechazada', motivo_rechazo, rechazada_at
        │
        ├─► liberar_conceptos_de_proforma()
        │     ├─► UPDATE conceptos_venta SET proforma_id=NULL, estado_facturacion='pendiente'
        │     └─► UPDATE embarques SET tiene_proforma = (queda otra proforma?)
        │
        ├─► INSERT bitacora_actividad (con conceptos_liberados)
        │
        └─► INSERT notificaciones_internas (admins/operadores/contadores)
                    │
                    ▼
        Embarque muestra <AvisoProformasRechazadas>
                    │
                    ▼
        Operador clic "Generar nueva proforma" → wizard con conceptos ya libres
```
