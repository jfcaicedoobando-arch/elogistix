## Objetivo

Que el **folio y número de factura sean los que asigna FacturAPI al timbrar** (source of truth). Mientras la factura sea borrador, no consume folio interno del sistema. Además, **eliminar un borrador revierte la proforma** a su estado previo (aceptada, sin factura ligada).

## Cambios en la base de datos (migraciones)

### 1. Conversión Proforma → Factura sin reservar folio

`convertir_proformas_a_factura` deja de llamar a `reservar_folio_factura`. En su lugar:

- `folio_fiscal` = `NULL` en el borrador.
- `serie` = `NULL` (la definirá FacturAPI al timbrar; sólo guardamos `serie_id` como referencia editable).
- `numero` = placeholder temporal `BORRADOR-<8 chars uuid>` para respetar la restricción `UNIQUE NOT NULL` sin ocupar consecutivo real.

### 2. `facturapi-emitir` asigna el folio interno al timbrar

Cuando FacturAPI responde OK, la edge function (o un nuevo RPC `finalizar_folio_factura(factura_id)`):

- Lee `folio_number` y `series` que devolvió FacturAPI.
- Actualiza `facturas.folio_fiscal`, `serie`, `uuid_fiscal`, `facturapi_id`.
- Setea `numero` = `<serie><folio>` (mismo formato actual, pero con los valores que FacturAPI mandó — no los reservados por nosotros).
- Si dos borradores se timbran en distinto orden, el `numero` reflejará el orden real de FacturAPI.

### 3. Nuevo RPC `eliminar_factura_borrador(p_factura_id)`

- Sólo permite eliminar si `estado = 'Borrador'` y `facturapi_id IS NULL` (nunca se timbró).
- Restringido a `admin_org` / `contador` / `super_admin` y misma organización.
- Borra `conceptos_factura` de esa factura.
- **Revierte las proformas asociadas** (tanto la ligada por `proforma_id` como todas las que tengan `factura_id = p_factura_id`):
  - `factura_id = NULL`
  - `estado_proforma = 'pendiente'` (queda como estaba antes de convertir; `estado_cliente` sigue en `aceptada`, así que el botón "Convertir a factura" vuelve a habilitarse).
  - `fecha_facturacion = NULL`
- Borra la fila de `facturas`.
- Registra la acción en `bitacora_actividad`.

### 4. Reservar folio sólo al timbrar

`reservar_folio_factura` deja de llamarse desde `convertir_proformas_a_factura`. Sólo se usará como fallback si algún día facturáramos sin FacturAPI (fuera de alcance ahora).

## Cambios en el frontend

### Lista y detalle de facturas

- Columna "Número": si `estado = 'Borrador'` y no hay `folio_fiscal`, mostrar chip gris "Sin folio (borrador)"; si ya está timbrada, mostrar `serie + folio` normal.
- En el detalle del borrador, ocultar el "Folio fiscal" hasta timbrar.

### Botón "Eliminar borrador"

- Nuevo botón en el detalle de la factura, sólo visible si `estado = 'Borrador'`, `facturapi_id IS NULL` y el usuario tiene `canEmitirFactura`.
- Confirmación tipo `ELIMINAR` (patrón existente `data-safety-confirmations`).
- Llama al RPC `eliminar_factura_borrador` y redirige a `/facturacion`.
- Toast: "Borrador eliminado. La proforma volvió a estar disponible para convertir."

### Proforma que estaba `facturada`

- Al revertirla queda `estado_proforma = 'pendiente'` + `estado_cliente = 'aceptada'`, por lo que `AccionesProforma` vuelve a mostrar "Convertir a factura" automáticamente. No requiere cambios extra.

## Detalles técnicos

- `facturas.numero` seguirá siendo `UNIQUE NOT NULL`. El placeholder `BORRADOR-<uuid8>` garantiza unicidad sin tocar `factura_series.folio_actual`.
- El search interno / búsqueda global filtrará borradores por expediente / cliente (no por número, ya que aún no lo tienen).
- Compatibilidad: facturas existentes que ya tienen folio se mantienen; el cambio sólo afecta a nuevos borradores.
- Tests:
  - Unit: `convertirAFactura.test.ts` — el resultado ya no depende de `reservar_folio_factura`.
  - Unit nuevo: `eliminarBorrador.test.ts` (mock RPC).
  - E2E `03-factura.spec.ts`: agregar caso "eliminar borrador revierte proforma".
- Bump `APP_VERSION` a `13.146.0` + entrada en `CHANGELOG.md`.

## Fuera de alcance

- Cambiar el flujo de facturas manuales (`facturaManual.ts`) — se puede alinear después.
- Cambiar el formato del `numero` post-timbrado (sigue siendo `<serie><folio_fiscal>`).
- Papelera / soft-delete: los borradores se eliminan duro porque no tienen valor fiscal.
