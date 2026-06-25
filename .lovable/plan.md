## Problema

Cuando un admin avanza el embarque a **"Cerrado"** desde el botón "Avanzar estado", el backend ejecuta `avanzar_estado_embarque`, que:

1. Cambia `estado = 'Cerrado'` en `embarques`.
2. Intenta insertar una nota en `notas_embarque` y un evento en `eventos_embarque`.

El trigger `trg_bloquear_cierre` ve que el embarque ya quedó en `Cerrado` y rechaza el INSERT con `check_violation`: *"Embarque cerrado: edición bloqueada (tabla eventos_embarque)"*. Resultado: el estado se queda a medias (cambió a Cerrado, pero sin nota/evento ni snapshot de cierre) y al usuario le sale el toast de error.

Además — bug colateral importante — este flujo **nunca llama a `cerrar_embarque`**, así que cuando se "avanza a Cerrado" no se genera el snapshot financiero, no se escribe en `cierre_embarque_log` ni se marcan las `comisiones_devengadas` como definitivas. Sólo el botón "Cerrar embarque" del tab de Cierre invoca la RPC correcta.

## Solución

Hacer que `avanzar_estado_embarque` delegue el cierre a `cerrar_embarque` cuando el estado destino es `Cerrado`, y que las inserciones de tracking se hagan con el bypass activo.

### Cambios

**1. Migración SQL — actualizar `public.avanzar_estado_embarque`**

Al inicio del cuerpo, si `p_nuevo_estado = 'Cerrado'`:

- Reclamar idempotencia y resolver `v_org_id` como hoy.
- Llamar `PERFORM public.cerrar_embarque(p_embarque_id)`. Esto:
  - Reusa la validación de rol y checklist (con bypass para admin que ya existe).
  - Genera el snapshot financiero, el log en `cierre_embarque_log` y marca comisiones definitivas.
  - Deja el estado en `Cerrado` con `cerrado_at` / `cerrado_por`.
- Activar `set_config('app.bypass_cierre','on', true)` y insertar la nota + evento de tracking (para que el timeline siga mostrando "Cambio de estado a Cerrado"), luego desactivar el bypass.
- Guardar la respuesta de idempotencia y `RETURN`.

Para el resto de estados, conservar el flujo actual sin cambios.

**2. Bump de versión** a `13.135.61` + entrada en `CHANGELOG.md`.

### Lo que NO se toca

- Trigger `tg_bloquear_si_embarque_cerrado`: sigue protegiendo edits post-cierre.
- RPC `cerrar_embarque`: ya tiene la lógica de admin forzado y snapshot.
- Frontend (`useEmbarqueEstadoActions`, `useAvanzarEstadoEmbarque`): no requiere cambios; la mutación ya invalida las queries correctas.

### Validación

- Como admin (estado Entregado → Cerrado): el avance debe registrar log de cierre, marcar comisiones definitivas, y dejar la nota + evento visibles en el timeline, sin toast de error.
- Como rol no autorizado: debe fallar con el mensaje de `cerrar_embarque` ("No autorizado para cerrar embarques…"), no con el de check_violation.
- Avances a otros estados (Confirmado, En Tránsito, etc.): comportamiento idéntico al actual.

## Analogía

Hoy es como cerrar la puerta con llave y *después* intentar meter un papelito por debajo — la puerta ya no deja pasar nada. El fix es: primero metes el papelito y luego cierras; y de paso, usar el procedimiento oficial de cierre que además llena la bitácora y sella las comisiones.