# Arreglo del fallo de CI en la validación de sesión

## Qué pasó

CI falla al revisar tipos en `supabase/functions/_shared/auth.ts`: cuando no se
puede validar la sesión, el aviso al registro de eventos usa dos campos
(`status` y `motivo`) que no existen en el formato de registro permitido. Es
como llenar un formulario con dos casillas inventadas: el revisor lo rechaza.

## Cambio propuesto (mínimo, sólo un archivo)

En el aviso `auth_getuser_no_disponible`, usar los campos válidos del formato:

- `status` pasa a `status_code`.
- `motivo` pasa dentro de `payload`.

No cambia el comportamiento: se sigue reintentando una vez, se sigue
distinguiendo 401/403 (token inválido) de fallos de infraestructura (503) y se
conserva la misma información en el registro.

## Detalles técnicos

- `LogContext` (en `_shared/logger.ts`) admite `request_id`, `user_id`,
  `organization_id`, `status_code`, `latency_ms`, `payload`.
- Ajuste en `verificarUsuario`:
  `log?.warn?.("auth_getuser_no_disponible", { status_code: statusDe(ultimoError), payload: { motivo: ... } })`.
- Sin tocar Edge Functions desplegadas, SQL, migraciones, RLS, permisos ni datos.
- Se actualiza `APP_VERSION` y `CHANGELOG.md`.
- Validación local sólo focalizada (typecheck/lint del archivo). Las suites
  completas, RLS y CI quedan para GitHub Actions.
