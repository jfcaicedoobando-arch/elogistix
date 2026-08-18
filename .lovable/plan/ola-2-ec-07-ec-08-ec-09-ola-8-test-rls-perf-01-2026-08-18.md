# Ola 2 (EC-07 / EC-08 / EC-09) + Ola 8 (test RLS PERF-01)

Los dos documentos describen hallazgos que siguen abiertos en el código actual. Verifiqué cada uno antes de armar el plan.

## Qué está confirmado hoy

- No existe el helper `formatFechaSegura` en `src/lib/formatters/`; varias pantallas formatean con `date-fns format(new Date(...))` o `d.toISOString()`, que truenan el render completo si la fecha viene inválida (`papelera`, `Idempotencia`, `AlertasSistemaPanel`, `AsignacionExistenteInfo`).
- `ResetPassword` llama `getCurrentSession().then(...)` sin `.catch`: si falla, la pantalla se queda en spinner para siempre.
- `proformas/services/destinatarios.ts` sólo desestructura `{ data }` y se come el error: el usuario ve "sin sugerencias" cuando en realidad hubo un fallo.
- La descarga de MSDS en `MercanciaInfoGrid` es un `onClick` async sin `try/catch`.
- `cxp/services/facturasEntrantesRealtime.ts` se suscribe a `embarque_facturas_entrantes` **sin filtro de organización**: recibe eventos de todos los tenants (ruido e invalidaciones cruzadas).
- No existe `supabase/tests/rls/test_rls_restrictive_perf01_permissive_backup.sql`; la suite RLS actual no vigila que cada tabla con la policy RESTRICTIVE de PERF-01 conserve su policy PERMISSIVE de respaldo.

## Qué se va a hacer

### EC-07 · Fechas inválidas ya no tumban la pantalla
Nuevo helper `formatFechaSegura` (valida la fecha, y si es inválida muestra "—" en lugar de romper) exportado desde `@/lib/formatters`, aplicado en papelera, Idempotencia, panel de alertas del sistema y asignación de responsable en auditoría. Se elimina el adaptador `dtf` de papelera (su único consumidor era la tabla).

### EC-08 · Promesas con manejo de error
- Descarga de MSDS: `try/catch` con aviso de error al usuario.
- `ResetPassword`: `.catch` que muestra el mensaje traducido y libera el spinner.
- `destinatarios.ts`: propaga el error de la base (react-query lo pinta como estado de error) y limita la consulta de contactos a 200 filas.

### EC-09 · Realtime del buzón CxP filtrado por organización
`subscribeEntrantesBuzon(orgId, onChange)` con canal por org y `filter: organization_id=eq.<org>`, siguiendo el patrón ya usado en notificaciones. El hook del badge pasa la org activa, con guard si aún no hay org, y la incluye en las dependencias del efecto.

### Ola 8 · Test estructural de RLS
Nuevo test `test_rls_restrictive_perf01_permissive_backup.sql`: para toda tabla con la RESTRICTIVE de PERF-01, exige al menos una PERMISSIVE que filtre por tenant/rol; si no, falla con instrucciones para extender la lista blanca documentada (catálogos globales, tablas sólo de servicio, portales por usuario, infra interna). Evita el escenario silencioso en que una tabla queda ilegible o el aislamiento depende de una sola expresión.

## Detalles técnicos

- `formatFechaSegura(valor, patrón)` en `src/lib/formatters/dates.ts`: guard `isValid` + `try/catch` + fallback `"—"`; test nuevo `dates.segura.test.ts`.
- `notifyError(undefined, { title, error, method })` para el catch de MSDS (firma real del helper).
- Test del hook CxP actualizado a la nueva firma de `subscribeEntrantesBuzon`.
- El test RLS sigue el estilo DO-block sobre `pg_policies` con `BEGIN/ROLLBACK`, igual que `test_rls_policy_linter.sql`; exenciones alineadas con ese linter.
- Sin migraciones de base de datos: los cambios son de frontend más un test de la suite RLS.
- `CHANGELOG.md` + `APP_VERSION` con la versión correspondiente.
