## Objetivo

Cuando se cancela una factura timbrada que provino de una proforma, la proforma debe **regresar automáticamente a estado "pendiente"** (limpiando el vínculo a la factura, fecha de facturación y folio externo), para que el usuario pueda volver a facturarla desde la bandeja de proformas.

Esto replica el comportamiento que ya existe cuando se elimina un **borrador** de factura (RPC `eliminar_borrador_factura`), pero aplicado al flujo de **cancelación SAT** (`facturapi-cancelar`).

## Contexto encontrado

- `supabase/functions/facturapi-cancelar/index.ts` cancela en SAT, guarda acuse y marca la factura como `Cancelada`, pero **no toca la proforma origen**.
- Al facturar (`src/features/proformas/services/facturar.ts`), se guardan en la proforma: `estado_proforma = 'facturada'`, `factura_id`, `factura_secundaria_id`, `fecha_facturacion`, `folio_factura_externa`.
- Una proforma puede haber generado **1 o 2 facturas** (venta + demoras). Sólo debe revertirse el campo que corresponde a la factura cancelada; la proforma vuelve a `pendiente` únicamente cuando **ya no quedan facturas activas** ligadas a ella.
- El RPC `eliminar_borrador_factura` ya usa exactamente este patrón (`estado_proforma = 'pendiente'`, `fecha_facturacion = NULL`, limpia `factura_id`).

## Cambios

### 1. Edge function `facturapi-cancelar` — revertir proforma

Después de marcar la factura como `Cancelada` (y guardar acuse), agregar un bloque:

1. Consultar todas las proformas de la organización donde `factura_id = facturaCancelada.id` **o** `factura_secundaria_id = facturaCancelada.id`.
2. Para cada proforma encontrada:
   - Limpiar el campo que apunta a la factura cancelada (`factura_id` o `factura_secundaria_id`).
   - Si tras la limpieza **ambos** vínculos quedan en `NULL`, poner `estado_proforma = 'pendiente'`, `fecha_facturacion = NULL`, `folio_factura_externa = NULL`.
   - Si aún queda la otra factura activa, dejar `estado_proforma = 'facturada'` (sólo se limpia el campo puntual).
3. Registrar el evento en `bitacora_actividad` con acción `factura.cancelada_proforma_revertida` incluyendo `proforma_ids` y `estado_resultante`.

Este bloque **no se ejecuta** cuando la invocación viene con `solo_descargar_acuse: true` (ese flag sólo re-baja el acuse, no cancela).

### 2. UI de proformas — sin cambios de lógica

- La bandeja de proformas ya filtra por `estado_proforma` y ya muestra el botón "Facturar" para las que están en `pendiente`/`aceptada`, así que el cambio de estado hará que la proforma reaparezca automáticamente lista para volver a facturarse.
- Se agrega un test unitario ligero al servicio que verifica la lógica de reversión (mock del cliente Supabase).

### 3. Historial visible

- El evento `factura.cancelada` ya se registra hoy; con el nuevo bloque se añade `factura.cancelada_proforma_revertida`. Aparecerá en el **Historial de la factura** y en la bitácora general de la proforma.

### 4. Housekeeping

- Bump `APP_VERSION` a `13.205.8`.
- Entrada en `CHANGELOG.md` bajo `[13.205.8]`.

## Diagrama del nuevo flujo

```text
Cancelar factura F1
   ├─ SAT cancel + guardar acuse
   ├─ facturas.estado = 'Cancelada'
   └─ proformas ligadas a F1:
        ├─ limpiar factura_id / factura_secundaria_id según corresponda
        ├─ si ambos NULL  → estado_proforma = 'pendiente'
        │                    fecha_facturacion = NULL
        │                    folio_factura_externa = NULL
        └─ bitacora: factura.cancelada_proforma_revertida
```

## Fuera de alcance

- No se toca `facturapi-cancelar-nota-credito` ni `facturapi-cancelar-rep` (facturas ligadas a pagos, no a proformas).
- No se cambia el modelo de datos ni RLS.
- No se agrega botón manual de "revertir" — la reversión es automática al cancelar.

## Duda antes de construir

Si la proforma originó **dos facturas** (venta + demoras) y sólo cancelas una, ¿prefieres:

- **(A)** Dejar la proforma como `facturada` mientras la otra factura siga activa, y sólo volver a `pendiente` cuando ambas estén canceladas (propuesto arriba), o
- **(B)** Volver a `pendiente` en cuanto se cancele cualquiera de las dos?

Si no respondes, procedo con **(A)** por ser el comportamiento más seguro (no se re-factura algo que ya tiene otra factura activa).
