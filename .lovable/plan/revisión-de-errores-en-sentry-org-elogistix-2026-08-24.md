# Revisión de errores en Sentry (org `elogistix`)

Hay 3 issues sin resolver en los últimos 14 días. Sólo uno es un bug real de producto; los otros dos son ruido que hoy ensucia el tablero.

## 1. `JAVASCRIPT-REACT-1G` — Bug real: el botón "Ver demo" falla (bloqueante)

- Error: `permission denied for function seed_demo_organization_guarded` (Postgres `42501`), edge function `demo-access`, HTTP 500. Última ocurrencia: hoy 13:47 UTC, 3 usuarios afectados.
- Efecto para el usuario: quien presiona "Ver demo" en el login recibe un fallo y no entra a la cuenta demo.
- Lo verificado: en la base, la función `seed_demo_organization_guarded(bigint)` sólo tiene `EXECUTE` para `service_role`; la llamada previa de la misma función edge (`ensure_demo_membership`) sí está otorgada a `authenticated` **y** a `service_role`. Como esa primera llamada pasa y la segunda no, la sospecha principal es que la petición **no está corriendo como `service_role`** (analogía: la llave maestra que abre la primera puerta no es la maestra, sólo la de visitante, y la segunda puerta exige maestra). Esta causa **no está confirmada**: la edge function no tiene logs retenidos.

**Paso 1 (diagnóstico, antes de cambiar nada):** invocar `demo-access` en el entorno real y registrar el rol efectivo de la conexión (`select current_user, current_setting('request.jwt.claims', true)` desde una RPC de diagnóstico temporal o un log puntual en la función), para saber si el problema es la credencial de servicio o el permiso.

**Paso 2 (fix según el resultado):**
- Si el rol efectivo NO es `service_role`: corregir la creación del cliente admin en `supabase/functions/demo-access/index.ts` para forzar la credencial de servicio en los headers (`global.headers` con `apikey` + `Authorization`) y fallar de forma explícita y legible si la variable de servicio no está presente, en lugar de degradar silenciosamente a un rol sin permisos.
- Si el rol sí es `service_role`: el `GRANT` se perdió en tiempo de ejecución; migración espejo que reafirma `REVOKE` a `PUBLIC`/`anon`/`authenticated` + `GRANT EXECUTE ... TO service_role`, más una prueba SQL de regresión que verifique el ACL (queda dentro del contrato FIX-45: la función sigue prohibida para `anon`).

**Paso 3:** mensaje de error claro en el diálogo de demo del front (hoy sólo se ve `demo_access_failed`), y marcar el issue como `resolved` en Sentry + entrada en `CHANGELOG.md` con bump de `APP_VERSION`.

## 2. `JAVASCRIPT-REACT-5J` — No es bug: validación esperada

- `Password is known to be weak and easy to guess, please choose a different one.` en `/login`. Es la validación de contraseñas de la plataforma de autenticación avisando correctamente al usuario.
- Acción: tratarlo como aviso esperado (igual que ya se hace con el límite de reenvío de correo) agregando un filtro en `src/lib/ui/appFeedback.sentry.ts` para que no llegue a Sentry, y marcar el issue como `resolved`.

## 3. `JAVASCRIPT-REACT-5F` — No es bug de la app: ruido de DOM externo

- `NotFoundError: Failed to execute 'insertBefore' ...` en `/`, 1 evento, 0 usuarios. Patrón típico de extensiones del navegador/traductores que mueven nodos bajo React.
- Acción: agregarlo a `IGNORE_ERRORS` en la configuración de Sentry y marcar el issue como `ignored`.

## Detalles técnicos

- Archivos previstos: `supabase/functions/demo-access/index.ts`, migración espejo en `supabase/migrations/` (según resultado del Paso 1), prueba SQL en `supabase/tests/`, `src/lib/ui/appFeedback.sentry.ts`, configuración de `IGNORE_ERRORS` en `src/lib/observability/sentry/`, `src/constants/appVersion.ts` y `CHANGELOG.md`.
- Se respeta el contrato FIX-45 (ninguna función `SECURITY DEFINER` nueva ejecutable por `anon`) y se sincroniza el manifiesto de migraciones si se agrega una.
- Al cerrar, se marcan los issues en Sentry en el mismo turno del fix, referenciando el ID en el CHANGELOG.
