Diagnóstico:
- El request de actualización sí guardó `etd: 2026-04-07` y `fecha_llegada_real: 2026-05-03`.
- No envió `eta` en el PATCH, por eso el ETA del resumen quedó en `2026-05-17`.
- La causa probable es que el código trata ATA como `fecha_llegada_real` separada, pero no actualiza `eta` cuando JSONCargo solo permite inferir la fecha real de llegada desde el último movimiento descargado/en puerto.

Plan de implementación:
1. Ajustar la acción “Actualizar embarque” para que, cuando exista ATA inferida y no exista un ETA nuevo explícito de JSONCargo, use esa ATA como ETA operativo del embarque.
2. Mantener también la escritura de `fecha_llegada_real`, para que el resumen muestre “Llegada Real” y el ETA quede alineado con la fecha real cuando el contenedor ya fue descargado.
3. Mejorar el texto visual en la tarjeta de tracking para que quede claro que esa fecha se aplicará como ETA/ATA cuando proviene del último movimiento.
4. Invalidar correctamente la caché del detalle completo del embarque (`get_embarque_full`) después de aplicar fechas, para que el tab Resumen se refresque sin depender de recargar la página.
5. Agregar entrada al changelog con la versión nueva, siguiendo la regla del proyecto.