# Arreglar "permission denied for table embarques" en /embarques

## Qué está pasando (analogía)

Ayer, por seguridad, cerramos con llave 4 cajones internos del archivero de embarques (`cerrado_snapshot`, `tarifa_delta_jsonb`, `reabierto_motivo`, `created_by_email`): en lugar de dar acceso al archivero completo, entregamos llaves cajón por cajón (74 de 78 columnas).

El problema es que la función que arma el listado de embarques pide "tráeme el archivero completo" (`SELECT e.*`), y ese permiso ya no existe. Postgres responde `permission denied for table embarques` (42501) y el listado se cae para cualquier usuario del staff, no solo para el coordinador que lo reportó.

Confirmado en la base de datos:
- `public.embarques` ya no tiene `SELECT` a nivel tabla para `authenticated`/`anon`; sí tiene `SELECT` en 74 columnas.
- `public.embarques_listado(...)` no es `SECURITY DEFINER`, así que corre con los permisos del usuario y su cuerpo hace `SELECT e.* FROM embarques e`.

## Alcance del daño

- Rota: la lista de `/embarques` (y su exportación, que usa la misma RPC en bloques).
- Revisadas y sanas: `get_embarque_full`, `cartera_pendiente`, `cxp_por_capturar`, `cxp_por_pagar`, `eerr_resumen_anual`, `facturacion_por_emitir`, `clientes_listado`, `cotizaciones_listado` — todas nombran columnas explícitas.
- Frontend: ninguna consulta a `embarques` usa `select("*")`; todas nombran columnas.

## Cambios propuestos

1. **Migración**: recrear `public.embarques_listado(...)` cambiando `SELECT e.*` por la lista explícita de columnas que la función realmente necesita (las 25 que devuelve más `id`, `organization_id`, `deleted_at`, `created_at` y las columnas ordenables: `expediente`, `cliente_nombre`, `modo`, `estado`, `etd`, `eta`, `operador`). Sin cambios de firma, de filtros ni de orden, para no tocar el frontend.
2. **Prueba de regresión** en `supabase/tests/`: ejecutar `embarques_listado` como `authenticated` y verificar que no lanza 42501, más una aserción de que los 4 cajones internos siguen cerrados a nivel columna (para que el fix no reabra el hueco de seguridad).
3. **Sincronizar** `supabase/releases/migration-manifest.json` con la nueva migración.
4. **CHANGELOG.md** + `APP_VERSION` a `13.737.1`.

## Verificación

- Correr la RPC con el rol `authenticated` desde psql y confirmar filas de vuelta.
- Abrir `/embarques` en el preview con sesión de staff y confirmar que carga el listado.
- Correr las suites existentes `supabase/tests/fix2_embarques_interno_y_nc.sql` y `fix45_anon_execute_whitelist.sql` para asegurar que el endurecimiento previo sigue intacto.
