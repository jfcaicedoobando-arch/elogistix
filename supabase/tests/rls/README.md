# Pruebas SQL y RLS

Revisado el **2026-09-26** contra workflow/scripts.
Aislamiento, permisos y reglas financieras/operativas en PostgreSQL efímero,
**no Live**.

## Actions

Workflow por rutas DB/manual; un job **`RLS tests result`**.
PostgreSQL 17.9 pinneado, cliente 17. Sin matriz de cinco grupos,
radar no bloqueante ni transporte de snapshots.

Orden: bootstrap → squash/replay → service-role-only → post-migrate →
cobertura → integridad → baseline antes de fixtures → guards → suites →
concurrencia de cotización ganadora.

`run-rls-suites.sh` descubre `test_rls_*.sql` y comprueba `BEGIN … ROLLBACK`.
Inventario vivo: archivos, no lista copiada en README.
`run-guards.sh` usa el manifiesto bloqueante; consultar scripts para exclusiones,
concurrencia y artefactos.

## Catálogos compartidos

| Archivo | Responsabilidad |
| --- | --- |
| `_ci_exempt_tables.sql` | Exenciones justificadas |
| `_ci_service_role_only.sql` | Firmas internas curadas |
| `_ci_check_service_role_only.sql` | Candado bidireccional |
| `_ci_post_migrate.sql` | Preparación exclusiva CI |
| `../_catalogo_columnas_internas.sql` | Columnas internas financieras/PII |
| `../_decisiones_negocio.sql` | Contratos de guards |
| `_helpers.sql` | Seeds/aserciones |

No autogenerar la lista service-role-only del esquema que se intenta vigilar.
Una función nueva necesita REVOKE/GRANT y firma justificada cuando corresponda.

## Diagnóstico local

Suite completa en Actions. Cuando haga falta preparar schema aislado:

```bash
bun run db:postcheck
bun run db:postcheck -- --check
```

Primero puede regenerar baseline; segundo sólo comprueba.
Docs-only no necesita estos comandos.

Replay rojo: revisar orden efectivo/bootstrap. Permisos: firma/lista/grants.
Baseline: diff y normalización. Guard/suite: contrato aprobado y fixture.
Concurrencia: locks/invariantes y limpieza.
No relajar guard ni aumentar excepciones sólo para conseguir verde.

## Suite nueva

Nombre `test_rls_*.sql`, transacción `BEGIN … ROLLBACK`, helpers compartidos,
roles/orgs explícitos y asserts que fallen con excepción.
Skips controlados con `pg_temp.skip()` / `assert_max_skips()` cuando aplique.
Nuevo guard debe declararse en `supabase/tests/_guards_manifest.txt`.

El ensayo concurrente usa varias conexiones y limpia su fixture;
no cabe en una transacción de una sola conexión.

Nunca correr bootstrap/post-migrate/provisioning/fixtures contra producción.
Que una suite termine en rollback no justifica ejecutarla en Live.
