# Baseline de esquema (estado final esperado)

## Qué problema resuelve

CI ya verificaba que las migraciones **apliquen** en una base limpia (drift radar)
y que la base **funcione** (suites RLS, guardia de integridad). Lo que nadie
miraba era que el esquema final fuera **exactamente** el esperado: si una
migración borra un índice, relaja un `CHECK`, abre un `GRANT`, elimina un trigger
o cambia el cuerpo de una RPC sin querer, todo pasaba en verde.

La baseline es la radiografía de referencia: un `pg_dump --schema-only`
normalizado del esquema `public`, versionado en el repo.

- Archivo: `supabase/schema/baseline.sql`
- Generador: `scripts/db/schema-snapshot.sh`
- Job de CI: `rls-tests.yml → schema-baseline` (bloqueante, agregado en
  `rls-tests-result`)

Cubre tablas, columnas, tipos/enums, índices, constraints, triggers, cuerpos de
funciones/RPCs, políticas RLS y GRANTs. No incluye datos.

## Flujo en CI

1. El job `rls` prepara la base (bootstrap → drift → migraciones en orden →
   post-migrate) y publica el dump como artifact.
2. `schema-baseline` restaura ese dump, genera el snapshot normalizado y lo
   compara con `supabase/schema/baseline.sql`.
3. Si hay diferencia, falla mostrando el diff en el resumen del run y sube los
   artifacts `schema-snapshot-actual` y `schema-baseline-diff`.

## Cuando el cambio es intencional

Cualquier migración que modifique el esquema **debe** venir con la baseline
regenerada en el mismo PR:

```sh
bun run db:baseline:update   # docker + migraciones + regenera baseline.sql
git add supabase/schema/baseline.sql
```

El diff de la baseline es parte del review: ahí se ve, en una sola vista, qué
cambió realmente en la base.

## Verificar sin regenerar

```sh
bun run db:baseline:check    # falla mostrando el diff, sin tocar el archivo
```

## Primera generación

Si `supabase/schema/baseline.sql` todavía no existe, el job falla con
instrucciones. Dos caminos:

- Local (recomendado): `bun run db:baseline:update` y commitear el archivo.
- Sin Docker local: descargar el artifact `schema-snapshot-actual` del run y
  commitearlo como `supabase/schema/baseline.sql`.

## Notas de determinismo

- `pg_dump` corre **dentro** del contenedor de la imagen Postgres pinneada
  (17.6, mismo digest en CI y en local). Un `pg_dump` de otra versión formatea
  distinto y generaría diffs falsos.
- El snapshot elimina líneas volátiles: comentarios, `SET` de sesión,
  `ALTER ... OWNER TO` y líneas en blanco.
- El orden de objetos es estable porque siempre se reconstruye desde una base
  limpia aplicando las migraciones en el mismo orden.

## Falsos positivos frecuentes

| Síntoma | Causa | Acción |
| --- | --- | --- |
| Diff enorme sin cambios de migraciones | `pg_dump` de otra versión | Regenerar con `bun run db:baseline:update` (usa el contenedor pinneado) |
| Diff sólo en cuerpos de funciones | `CREATE OR REPLACE` reformateado | Es real: revisar y commitear la baseline |
| Diff en `GRANT`/policies | Permisos abiertos o cerrados | Revisar con lupa: es exactamente lo que este job vino a atrapar |
| Diff sólo en `\restrict` / `\unrestrict` con token aleatorio | `pg_dump` 17 envuelve el dump con esos metacomandos | Ya se filtran en `schema-snapshot.sh`; si reaparecen, regenerar la baseline |
