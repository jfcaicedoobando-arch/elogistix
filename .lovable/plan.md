# Arreglar "Error al reabrir embarque" (Cerrado → Entregado)

## Qué está pasando (verificado en la base de datos)

La función `reabrir_embarque` sí tiene permiso para saltarse el candado de "embarque cerrado" (`app.bypass_cierre`), pero al guardar el cambio de estado se dispara un **segundo guardia** distinto: el trigger `trg_embarque_transicion_valida`, que revisa el mapa de transiciones permitidas y sólo se puede saltar con la bandera `app.bypass_transicion`. Ese mapa no permite `Cerrado → Entregado`, así que el trigger lanza `LC_TRANSICION_INVALIDA: no se permite pasar de Cerrado a Entregado` y la reapertura falla.

Analogía: la RPC trae la llave de la puerta principal (candado de cierre), pero hay una segunda reja con otra llave (validador de transiciones) que nadie le dio.

Además, el mensaje que ve el usuario ("El estado del registro cambió en otra sesión. Recarga la página") es el texto genérico del catálogo para `LC_TRANSICION_INVALIDA`, así que confunde: no hubo ninguna otra sesión.

## Cambios propuestos

1. **Migración de base de datos**: recrear `reabrir_embarque` para que active `app.bypass_transicion = 'on'` justo antes del `UPDATE` de estado y lo apague inmediatamente después (igual que ya hace con `app.bypass_cierre`). Todas las validaciones previas (rol admin, motivo ≥ 20 caracteres, estado actual = `Cerrado`, pertenencia a la organización) se conservan intactas, así que no se abre ningún hueco de seguridad: el único salto permitido sigue siendo el que la propia RPC autoriza.
   - Se mantienen `REVOKE ALL ... FROM PUBLIC` y `GRANT EXECUTE` explícitos (regla H6).

2. **Mensaje de error más claro** en `src/features/embarques/services/embarqueEstadoRpc.ts`: si el error de reapertura contiene `LC_TRANSICION_INVALIDA`, mostrar un texto específico de reapertura en lugar del genérico de "otra sesión".

3. **Tests**:
   - Test de contrato SQL que verifique que la definición de `reabrir_embarque` activa y desactiva `app.bypass_transicion` (mismo estilo que los tests existentes de grafo de transiciones).
   - Test unitario de `reabrirEmbarqueRpc` para el mapeo del nuevo mensaje.

4. **CHANGELOG.md** + bump de `APP_VERSION`.

## Verificación

Después de aplicar la migración, reabrir el embarque de la ruta reportada (`/embarques/6cab5bec-…`) debe pasar de `Cerrado` a `Entregado`, dejando la nota, el evento de tracking y el registro en la bitácora. Se marcará el issue de Sentry como resuelto referenciando el requestId en el changelog.
