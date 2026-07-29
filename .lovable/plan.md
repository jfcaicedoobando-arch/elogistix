## Qué está pasando

El embarque `ELIMP00007` (ruta `/embarques/b55ca3a2…`) **sigue en estado Cerrado**: la reapertura falló de verdad, no fue sólo un toast feo.

Verificado en la base de datos:

1. Existen **dos funciones `reabrir_embarque` distintas** con el mismo nombre:
   - `reabrir_embarque(p_embarque_id, p_motivo)` → exige motivo de mínimo 20 caracteres y valida el permiso contra la configuración global `cierre_admin_puede_reabrir`.
   - `reabrir_embarque(p_embarque_id, p_usuario_email, p_request_id)` → no pide motivo y valida roles admin/admin_org.
   El botón del encabezado usa la segunda; el diálogo de cierre usa la primera. Tener dos versiones del mismo nombre en la API es frágil y hace imposible saber cuál respondió.

2. El mensaje **"[object Object]"** viene de nuestro código: en `src/features/embarques/services/embarqueEstadoRpc.ts` el error de base de datos (un objeto, no un `Error`) se convierte con `String(e)`, que produce literalmente `[object Object]`. Por eso el motivo real se perdió y tampoco llegó a Sentry.

Analogía: la alarma sonó, pero alguien tapó la pantalla que decía *por qué* sonó. Primero destapamos la pantalla, luego arreglamos la causa.

## Plan

### 1. Dejar de perder el mensaje del error (bloqueante)

En `embarqueEstadoRpc.ts`:
- Usar `getErrorMessage(e)` (ya sabe leer `message`/`details`/`hint`/`code` de errores de base de datos) en vez de `String(e)`.
- Conservar siempre el error original como `cause` para que Sentry reciba el código real (`PGRST202`, `P0001`, etc.).
- Aplicar el mismo criterio en `avanzarEstadoEmbarqueRpc`.

Con esto, el próximo intento fallido dirá exactamente qué rechazó la operación.

### 2. Unificar la RPC en una sola firma

Migración de base de datos:
- Renombrar la versión legacy a `reabrir_embarque_con_motivo(p_embarque_id, p_motivo)` y eliminar la sobrecarga duplicada, de forma que `reabrir_embarque` quede con **una sola firma** en la API.
- Añadir motivo obligatorio también en la ruta del encabezado, guardándolo en `reabierto_motivo`, en `cierre_embarque_log` y en la bitácora (hoy el encabezado reabre sin motivo, lo que rompe la trazabilidad que sí exige el diálogo de cierre).
- Mantener `REVOKE ALL` + `GRANT EXECUTE TO authenticated` según la política H6 del auditor de migraciones.

### 3. Ajustar el frontend a la firma única

- `src/features/embarques/services/cierre.ts` → apunta a `reabrir_embarque_con_motivo`.
- Botón "Reabrir" del encabezado del embarque → pedir motivo (mínimo 20 caracteres) con el mismo diálogo/patrón que ya usa el módulo de cierre, en lugar de reabrir directo.
- `useEmbarqueReabrirCancelar` pasa ese motivo a la mutación.

### 4. Verificación

- Pruebas unitarias de `embarqueEstadoRpc` con un error tipo Postgrest para confirmar que ya no aparece `[object Object]`.
- Actualizar `src/features/embarques/services/__tests__/cierre.test.ts` al nuevo nombre de RPC.
- Reintentar la reapertura del embarque `ELIMP00007` y confirmar que queda en `Entregado` con registro en `cierre_embarque_log`.
- `bun run lint`, tests afectados y `bun run audit:migrations`.

### 5. Registro de cambios

`CHANGELOG.md` + `APP_VERSION` a `13.337.0`.

## Nota

No sabemos aún el motivo exacto del fallo original porque los registros de la API sólo conservan los últimos minutos y nuestro código lo borró. El paso 1 garantiza que si vuelve a ocurrir, el mensaje sea legible; los pasos 2 y 3 eliminan la causa más probable (dos funciones con el mismo nombre en la API).
