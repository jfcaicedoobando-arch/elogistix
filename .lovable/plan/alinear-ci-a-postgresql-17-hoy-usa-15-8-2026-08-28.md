# Alinear CI a PostgreSQL 17 (hoy usa 15.8)

## Qué encontré (verificado)

- Tu base de datos real (Lovable Cloud) corre **PostgreSQL 17.6**.
- El CI del repo levanta un Postgres **15.8** pinneado por digest (`.github/workflows/rls-tests.yml`, 7 servicios) y la baseline de esquema se genera con `pg_dump` 15.8 (`scripts/db/schema-snapshot.sh`, `scripts/db/local-verify.sh`).

Es decir: probamos las migraciones y el drift de esquema contra una versión de motor **distinta** a la de producción. Analogía: revisas los planos de la casa con la regla equivocada — casi siempre coincide, pero cuando no, o te da falsa alarma o te oculta una grieta real.

Riesgos concretos de mantener 15.8:
- Diferencias de comportamiento entre 15 y 17 (planner, `MERGE`, `SQL/JSON`, cambios en permisos de `public`) no se detectan en CI.
- `pg_dump` 17 formatea distinto que el 15 (por ejemplo, califica columnas de vistas con alias), por eso hoy la baseline debe generarse forzosamente con el contenedor 15.8.

## Propuesta

Migrar todo el pipeline de base de datos a Postgres 17, en un solo PR:

1. Cambiar el digest pinneado de la imagen Postgres a `postgres:17.6` (mismo esquema de pin por SHA) en `.github/workflows/rls-tests.yml` y en `scripts/db/local-verify.sh`.
2. Actualizar los comentarios y la doc que dicen "15.8" (`scripts/db/schema-snapshot.sh`, `docs/ops/baseline-esquema.md`).
3. Regenerar `supabase/schema/baseline.sql` con `pg_dump` 17 (el diff será grande pero mecánico: formato de vistas y privilegios).
4. Correr la suite completa de RLS + guards + replay de las 1157 migraciones sobre 17 y arreglar lo que rompa (esperable: 1-3 ajustes menores de sintaxis o de GRANTs en `public`).
5. Invalidar la cache del snapshot cambiando la key a `rls-snapshot-pg17.6-...`.
6. Bump de `APP_VERSION` + entrada en `CHANGELOG.md`.

## Detalles técnicos

- El pin sigue siendo por digest para evitar drift entre corridas.
- Punto de atención en PG 15→16→17: en 15 ya se revocó `CREATE` en `public` para no-dueños; en 17 cambian defaults de `pg_dump` sobre privilegios, por lo que la baseline puede mostrar `GRANT`/`REVOKE` explícitos que antes se omitían. Es formato, no cambio de seguridad.
- Si alguna migración antigua usa sintaxis retirada en 17, se corrige con una migración nueva (no se edita historia) o se ancla en `drift-anclas.txt`, como ya se hizo antes.

## Alternativa (si prefieres no tocar CI ahora)

Dejar 15.8 y documentar explícitamente en `docs/ops/baseline-esquema.md` que CI valida sobre una versión menor a la de producción, con la limitación asumida. No cuesta trabajo, pero el riesgo sigue abierto.
