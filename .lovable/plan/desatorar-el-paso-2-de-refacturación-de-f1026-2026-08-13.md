# Desatorar el paso 2 de refacturación de F1026

## Diagnóstico verificado

- La cancelación del REP de **F1026** sí llegó al backend el **13/08/2026 a las 16:13 (CDMX)** y respondió correctamente.
- El SAT/servicio fiscal no la confirmó de inmediato: devolvió **`verifying`**. En la base, el REP sigue fiscalmente vigente (`estado_rep = Timbrado`) y la solicitud está en verificación (`rep_cancellation_status = verifying`). Esto es correcto mientras llega la aceptación.
- La interfaz presenta dos problemas:
  1. `cancelarRep()` descarta la respuesta del backend, por lo que el hook muestra siempre el toast **“REP cancelado”**, incluso si sólo se envió la solicitud.
  2. El asistente no usa `rep_cancellation_status`; por eso sigue mostrando **“REP vigente”** y permite volver a pulsar “Cancelar REP”, en vez de indicar que está esperando respuesta.
- El caso de refacturación está abierto y conservado en el **paso 2**. No se perdió el expediente ni se ejecutó dos veces la operación.
- Existe una reconciliación automática cada 30 minutos y soporte por webhook para convertir el REP a `Cancelado` cuando la aceptación sea real.

Analogía: se entregó la solicitud en ventanilla, pero el sistema mostró “trámite terminado” cuando en realidad el SAT sólo dio un acuse de “en revisión”.

## Cambios a implementar

1. **Conservar el resultado real de cancelación**
   - Hacer que el servicio cliente devuelva `pending`, `cancellation_status` y el mensaje recibidos.
   - Diferenciar cancelación aceptada de solicitud pendiente.

2. **Corregir mensajes y estados del asistente**
   - Mostrar **“Solicitud de cancelación enviada”** cuando el resultado sea `pending`/`verifying`.
   - Reservar **“REP cancelado”** únicamente para `accepted`.
   - Incorporar `rep_cancellation_status` al modelo del pago mostrado en el asistente.
   - Mostrar badge **“Cancelación en verificación”** y deshabilitar el botón de cancelar mientras esté pendiente.
   - Mantener bloqueado “Continuar” hasta que `rep_cancelado_en` confirme la cancelación real, con una explicación clara.

3. **Mantener la pantalla sincronizada**
   - Mientras exista un REP en `pending`/`verifying`, refrescar periódicamente los pagos del modal.
   - Detener el refresco al llegar a un estado terminal (`accepted`, `rejected` o `expired`).
   - Mostrar un aviso accionable si la solicitud es rechazada o expira, permitiendo reintentar sólo entonces.

4. **Cobertura y validación**
   - Probar respuestas inmediata y pendiente del servicio.
   - Probar badges, bloqueo y reintento para `verifying`, `accepted`, `rejected` y `expired`.
   - Verificar en F1026 que el modal muestre “en verificación” y que avance automáticamente cuando el backend confirme `accepted`.
   - Actualizar `APP_VERSION` y `CHANGELOG.md`.

## Alcance técnico

- Frontend: servicio de REP, hook de cancelación, modelo/derivaciones del wizard y UI del paso 2.
- No se forzará manualmente `estado_rep = Cancelado`: ese dato sólo cambiará cuando exista confirmación fiscal real.
- No se modifica el flujo contable, el pago, la factura ni el caso de refacturación; sólo se corrige la semántica y sincronización del estado asíncrono.