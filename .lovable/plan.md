# Anticipos ligados a embarque: cerrar el cruce con la factura

## Lo que ya existe hoy (verificado en el código)

- Al registrar un anticipo ya hay una sección **"Vinculación con embarque (opcional)"** con buscador de expediente (`EmbarqueAnticipoPicker`), y el vínculo se guarda vía `registrar_anticipo_proveedor(p_embarque_id)`.
- El listado de anticipos muestra la columna de expediente (o "Sin embarque") y permite **Vincular embarque** después del alta.
- La pestaña Costos del embarque muestra la tarjeta "Anticipos a proveedores de este embarque".
- En el **detalle** de una factura de proveedor aparece el aviso "hay saldo a favor" y, al aplicar, avisa si el expediente del anticipo no coincide con el de la factura.

Así que el vínculo opcional ya está; lo que falta es el cruce en el momento en que se **captura/vincula la factura al embarque**.

## Lo que falta y propongo construir

1. **Aviso de anticipo durante la captura de la factura de proveedor** (buzón y captura manual): cuando ya se eligió proveedor y embarque, mostrar un aviso no bloqueante del tipo "Este embarque tiene 1 anticipo de USD 2,000 con saldo disponible a este proveedor", con el detalle de folio y fecha. Sólo informa; no aplica nada automáticamente.
2. **Priorizar el anticipo del mismo embarque** en el aviso y en el selector de aplicación del detalle de factura: los anticipos cuyo expediente coincide con el de la factura se ordenan primero y se marcan con un chip "Mismo expediente".
3. **Resumen en el embarque**: en la tarjeta de anticipos del embarque, mostrar por anticipo cuánto ya se aplicó a facturas de ese mismo embarque y cuánto queda disponible, para ver de un golpe si el adelanto ya se cruzó.
4. **Filtro rápido** en Tesorería/Compras → Anticipos: alternar "Sólo sin embarque" para detectar anticipos que quedaron sin expediente cuando sí correspondían a uno.

## Detalles técnicos

- Nuevo hook `useAnticiposDisponiblesPorEmbarque(proveedorId, embarqueId)` reutilizando `fetchAnticiposDisponibles` + filtro por `embarque_id` (sin cambios de esquema; la columna `anticipos_proveedor.embarque_id` ya existe).
- Nuevo componente `AvisoAnticipoEmbarque.tsx` en `src/features/anticipos-proveedor/components/`, montado en el flujo de captura de factura de proveedor (buzón y manual).
- Orden y chip "Mismo expediente" en `SelectorFacturaAbierta`/`AplicarAnticipoDesdeFacturaDialog` mediante una función pura nueva en `domain/` (con pruebas unitarias).
- Aplicaciones por anticipo/embarque leídas desde `anticipos_aplicaciones` (join a la factura para obtener su `embarque_id`).
- Sin migración de base de datos. Se agregan pruebas para la función de orden y para el hook nuevo, y se registra el cambio en `CHANGELOG.md` con bump de `APP_VERSION`.
