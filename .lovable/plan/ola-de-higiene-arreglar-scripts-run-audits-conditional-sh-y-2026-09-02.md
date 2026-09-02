# Ola de higiene: arreglar `scripts/run-audits-conditional.sh` y el replay roto

Tres fallas independientes en la corrida de auditorías. Alcance mínimo (YAGNI), sin features nuevas.

## 1. Dos auditorías con nombre inexistente (falso rojo)

El script llama `audit:release-manifest` y `audit:soft-delete-reads`, pero en `package.json` los scripts se llaman `audit:manifest` y `audit:soft-delete`. Corregir los dos nombres en el arreglo del script. Sin esto, CI siempre falla aunque todo esté bien.

## 2. Regresión real: se perdió el candado de cotización convertible

Verificado en el repo:

- `20260902045300_…sql` agregó a `crear_embarque_completo` la llamada a `_assert_cotizacion_convertible(cotizacion_id, org)`.
- La migración posterior `20260908000100_ola_p1_org_scope_credito_idempotencia.sql` redefinió la misma función **sin** ese candado.
- El espejo `supabase/schema/embarques/crear_embarque_completo.sql` sí lo tiene.

En un replay limpio gana la última migración, así que la base reconstruida quedaría sin la validación: se podría convertir a embarque una cotización no convertible (por ejemplo ya convertida o en estado inválido). Analogía: alguien reinstaló una versión vieja de la cerradura encima de la nueva; el plano (espejo) muestra la buena, la casa reconstruida tendría la vieja.

Arreglo: **nueva** migración con timestamp posterior que re-emita el cuerpo del espejo tal cual (con el `_assert_cotizacion_convertible` y sus `REVOKE`/`GRANT`). No se editan migraciones ya aplicadas.

## 3. Entrada muerta en el baseline del guardrail

`crear_embarque_borrador_desde_cotizacion` ya no diverge, y el guardrail exige borrar las entradas que dejaron de divergir. Quitar esa entrada de `scripts/audit-replay-mirror-baseline.json` (las demás quedan igual).

## Detalles técnicos

- `scripts/run-audits-conditional.sh`: `correr_siempre=(manifest)`, y en `correr_frontend` cambiar `soft-delete-reads` → `soft-delete`.
- Nueva migración `supabase/migrations/2026090900xxxx_replay_crear_embarque_completo_assert_convertible.sql` (`CREATE OR REPLACE FUNCTION` idéntico al espejo + REVOKE/GRANT). Se aplica vía la herramienta de migración con tu aprobación.
- Sincronizar el manifiesto de migraciones y bump de `APP_VERSION` + entrada en `CHANGELOG.md`.

## Verificación

- `bash scripts/run-audits-conditional.sh` completo en verde (incluye `audit:replay-mirror` y `audit:manifest`).
- `bun run db:postcheck` verde con la baseline regenerada en el mismo cambio.
- Typecheck y lint limpios.
