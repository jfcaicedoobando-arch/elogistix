## Qué pasa

El embarque está **Cerrado** y hay un candado en la base de datos (trigger `tg_bloquear_embarque_cerrado_self`) que rechaza cualquier cambio con el mensaje *"Embarque cerrado: usa reabrir_embarque para modificarlo"*. Ese candado sólo se abre si la operación levanta una bandera interna (`app.bypass_cierre`).

Existen **dos versiones** de la función `reabrir_embarque` en la base:

| Versión | Quién la usa | Levanta la bandera |
|---|---|---|
| `reabrir_embarque(embarque_id, motivo)` | Pestaña **Cierre** (con motivo mín. 20 caracteres) | Sí |
| `reabrir_embarque(embarque_id, usuario_email, request_id)` | Botón **Reabrir** del encabezado (`useEstadoEmbarque` → `reabrirEmbarqueRpc`) | **No** |

Analogía: hay dos llaves para la misma puerta; una desactiva la alarma antes de abrir y la otra no. El botón del encabezado está usando la llave que dispara la alarma, por eso siempre falla.

## Cambios propuestos

1. **Migración de base de datos**: en la versión `(embarque_id, usuario_email, request_id)`, envolver el `UPDATE embarques` con `set_config('app.bypass_cierre','on', true)` antes y `'off'` después, igual que la otra versión. Mantener `SECURITY DEFINER` + `REVOKE ALL` / `GRANT EXECUTE TO authenticated` como exige la auditoría H6.
2. **Consistencia de permisos**: dejar ambas versiones con la misma regla (admin/super_admin de la organización) y también marcar `comisiones_devengadas.definitiva = false` en la versión del encabezado, para que reabrir por cualquiera de los dos caminos deje el embarque en el mismo estado.
3. **Mensaje en la UI**: si el candado vuelve a dispararse por cualquier otra ruta, mapear el error `P0001` a un texto claro en español en el hook de reapertura, en lugar de mostrar el mensaje técnico.
4. **Tests**: añadir caso en `src/features/embarques/services/__tests__/mutations.test.ts` para el mapeo de error, y una verificación SQL de que la función contiene el bypass.
5. **CHANGELOG.md** + bump de `APP_VERSION` a `13.336.1`.

## Detalles técnicos

- Archivos tocados: nueva migración SQL, `src/features/embarques/hooks/mutations/useEstadoEmbarque.ts` (mapeo de error), tests, `CHANGELOG.md`, constante de versión.
- No se toca el trigger: el candado sigue protegiendo contra ediciones directas de embarques cerrados; sólo la RPC autorizada lo abre temporalmente dentro de su transacción.
