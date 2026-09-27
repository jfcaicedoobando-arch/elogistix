# Baseline de esquema

`supabase/schema/baseline.sql` es la referencia normalizada del schema final
esperado por CI, no una certificación de la base publicada.

## Workflow vigente (2026-09-26)

`rls-tests.yml`: un job **`RLS tests result`** prepara PostgreSQL 17.9:
bootstrap → squash/replay → permisos → post-migrate → cobertura/integridad →
baseline → guards → suites.

Baseline se compara **antes de fixtures**. No hay job separado
`schema-baseline` ni transporte de dumps entre jobs.
Dump dentro del contenedor pinneado, normalizado por
`scripts/db/schema-snapshot.sh`.

## Cambio intencional

```bash
bun run db:baseline:update
bun run db:baseline:check
```

Consultar requisitos del script local. No apuntarlo a Live.
Revisar diff junto con migración y espejo.

`db:postcheck` prepara/comprueba local y puede actualizar baseline;
`db:postcheck -- --check` compara sin actualizar.
No hace falta ejecutarlos por cambios sólo documentales.

| Diff | Revisar |
| --- | --- |
| Amplio sin SQL nuevo | Versión de pg_dump, bootstrap y normalización |
| RPC/función | Última definición efectiva y espejo |
| Policies/GRANT | Permisos cambiados |
| Índices/constraints/triggers | Intención vs regresión |
| Tokens restrict/unrestrict | Normalización del snapshot |

El workflow conserva diff/logs al fallar. No aceptar un artifact a ciegas.
Migraciones aplicadas siguen inmutables.
