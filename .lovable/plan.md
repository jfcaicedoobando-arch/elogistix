## Objetivo

Mejorar el tab **Garantías** del detalle de embarque para que:
1. La fecha de descarga se prellene desde la fecha de llegada real del embarque (editable).
2. El operativo pueda capturar el depósito real cuando la naviera no tiene carta de garantía (monto USD, banco/folio, notas).
3. Se calcule fecha límite de devolución del contenedor vacío y se muestre badge "vence en N días" / "vencido".
4. El sidebar y un mini-KPI alerten depósitos pendientes >30 días y muestren días promedio para recuperar dinero por naviera.

## Analogía rápida

Hoy el tab es un tablero de "lectura": ves qué contenedor tiene carta y cuánto se depositó, pero no puedes anotar el pago ni saber cuándo vence el plazo para que te lo devuelvan. Vamos a convertirlo en una libreta donde anotas el depósito al pagarlo, el sistema cuenta los días libres por ti, y te avisa cuando un dinero lleva demasiado tiempo "atorado" con la naviera.

## Cambios

### 1. Frontend — `TabGarantias.tsx`

- **Auto-prellenar fecha al cambiar estado**:
  - `depositado` → `fecha_deposito` = fecha de llegada real del embarque (`embarque.fecha_llegada_real`) si existe, si no hoy.
  - `liberado` → `fecha_liberacion` = hoy (sin cambios).
  - Ambas siguen siendo editables manualmente (ver punto 2).
- **Edición inline de monto y referencia** (solo si `canEdit` y `!tiene_carta_garantia`):
  - Input numérico para `monto_deposito_usd`.
  - Input de texto para `referencia_deposito` (folio/banco) — nueva columna.
  - Botón "editar fechas" abre un mini-popover con dos DatePickers para ajustar `fecha_deposito` y `fecha_liberacion`.
- **Nueva columna "Vence"**: si hay `fecha_deposito` y conocemos `dias_libres` de la naviera, mostrar fecha límite + badge:
  - verde "ok" si faltan >3 días, ámbar "por vencer" ≤3, rojo "vencido" si pasó.
- **Tarjetas KPI superiores**: agregar una cuarta "Días prom. recuperación" (promedio entre `fecha_deposito` y `fecha_liberacion` de los liberados de este embarque).

### 2. Backend — migración

- `embarque_garantias_contenedor`:
  - `ADD COLUMN referencia_deposito text` (folio/banco/cuenta).
  - `ADD COLUMN fecha_limite_devolucion date` generada por trigger = `fecha_deposito + dias_libres` (toma `dias_libres_demoras_default` de `costeo_navieras_condiciones` vía `naviera_id` y `organization_id`).
- Vista/RPC `kpi_garantias_por_naviera`: devuelve por naviera el conteo de depósitos pendientes y el promedio de días entre depósito y liberación de los últimos 90 días. La usa la tarjeta KPI y el sidebar.

### 3. Sidebar — alerta nueva

- En `useSidebarAlerts`, agregar contador de garantías con `estado IN ('depositado')` y `fecha_deposito < hoy - 30 días`. Badge ámbar en el item "Embarques" (mismo patrón que demoras).

### 4. Tests

- `garantias.test.ts`: agregar casos para `referencia_deposito` y para que `updateGarantia` permita pasar fecha_deposito explícita (ya existe parcial).
- Nuevo `TabGarantias.test.tsx` mínimo que verifica que al cambiar estado a "depositado" sin `fecha_llegada_real` usa hoy, y con `fecha_llegada_real` usa esa fecha.

### 5. Versionado + changelog

- `APP_VERSION` → `13.88.0` (cambio de feature, no solo fix).
- Entrada `[13.88.0]` en `CHANGELOG.md` describiendo las 4 mejoras.

## Validación

1. En `/embarques/<id>?tab=garantias`, cambiar un contenedor a "depositado" → la `F. Depósito` se llena con la fecha de llegada real del embarque.
2. Editar monto y referencia de un contenedor sin carta de garantía → persiste y se ve en la tabla.
3. Si la naviera tiene `dias_libres_demoras_default = 7` y depositaste hace 8 días, la columna "Vence" muestra badge rojo "vencido".
4. En sidebar, si hay ≥1 depósito >30 días sin liberar, aparece badge ámbar en Embarques.

## Nota sobre tu duda

Si la naviera **no** tiene carta de garantía, el depósito real se carga en ese mismo renglón del contenedor (el campo `monto_deposito_usd` que hoy sólo se ve, ahora será **editable**), más la nueva referencia bancaria. No es facturable y no entra al PnL del embarque (sigue siendo "dinero en custodia" que regresa al devolver el vacío).
