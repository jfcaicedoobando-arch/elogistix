# Tests de RLS — Aislamiento multi-tenant

Este directorio contiene pruebas SQL que verifican que las políticas
Row-Level Security (RLS) impiden el cruce de datos entre organizaciones.

## Cobertura actual (`test_rls_isolation.sql`)

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 1 | Admin Org A consulta `clientes` | Solo ve clientes de Org A |
| 2 | Admin Org B consulta `clientes` | Solo ve clientes de Org B |
| 3 | Admin A intenta `UPDATE` cliente de Org B | Cambio bloqueado |
| 4 | Admin A consulta `embarques` | Solo ve embarques de Org A |
| 5 | Cliente del portal consulta `embarques` | Solo sus propios embarques |
| 6 | Cliente del portal consulta `clientes` | Solo sus registros propios (≤1) |
| 7 | Admin A consulta `app_logs` | Solo logs de Org A |
| 8 | Insert en `bitacora_actividad` con `usuario_id` falso | Rechazado por `WITH CHECK` |

Suites adicionales:
- `test_rls_financiero.sql` — `facturas`, `proformas`, `cotizaciones`, gastos.
- `test_rls_financiero_critico.sql` — `cuentas_bancarias`, `bbva_movimientos`, `proveedor_facturas`, `pagos_factura`, `pagos_proveedor`, `cotizacion_costos`, `factura_notas_credito`, `comisiones_devengadas`, `liquidaciones_comision`.
- `test_rls_crm_operacional.sql` — `crm_leads`, `crm_oportunidades`, `crm_actividades`, `documentos_embarque`, `presupuesto_mensual` (8 aserciones).
- `test_rls_operaciones.sql` — `proveedores`, `conceptos_venta`, `conceptos_costo`, `conceptos_factura`, `embarque_contenedores`, `eventos_embarque`, `tracking_externo` (9 aserciones).
- `test_rls_tarifas_y_costeo.sql` — `costeo_rutas`, `costeo_tarifas` (incluye intento de UPDATE cruzado bloqueado y verificación de no fuga de `flete_base`), `proveedor_notas_credito` (monto contable nunca visible), `auditoria_revisiones` (detalle de cumplimiento aislado) (8 aserciones).
- `test_rls_roles_no_admin.sql` — matriz `{viewer, operador, cliente}` × `{SELECT, INSERT, UPDATE, DELETE}` sobre `facturas`, `pagos_factura`, `embarques`, `cotizaciones` (15 aserciones). Cubre el gap "todas las suites previas solo probaban `admin`".

## CI automatizado

El workflow `.github/workflows/rls-tests.yml` corre las 6 suites en cada
PR/push que toque `supabase/migrations/**` o `supabase/tests/rls/**`.

Flujo:

1. Levanta `postgres:15` efímero.
2. Aplica `_ci_bootstrap.sql` (stubs de `auth.uid/jwt/role` + `auth.users`
   + roles `anon/authenticated/service_role`).
3. Aplica todas las migraciones en orden alfabético.
4. Aplica `_ci_post_migrate.sql` (suelta los FK a `auth.users` para que
   los seeds con UUIDs aleatorios pasen).
5. Ejecuta cada suite con `psql -v ON_ERROR_STOP=1`. Cualquier
   `RAISE EXCEPTION` falla el job.

No requiere secrets ni toca Lovable Cloud / producción.

## Cómo correrlos local

Con Docker:

```bash
docker run -d --name pg-rls -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15
export PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
psql -v ON_ERROR_STOP=1 -f supabase/tests/rls/_ci_bootstrap.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -f "$f"; done
psql -v ON_ERROR_STOP=1 -f supabase/tests/rls/_ci_post_migrate.sql
for s in isolation financiero financiero_critico crm_operacional operaciones tarifas_y_costeo; do
  psql -v ON_ERROR_STOP=1 -f "supabase/tests/rls/test_rls_${s}.sql"
done
```

Contra una base ya provisionada por Supabase (staging) basta con saltar
los pasos 1-2 y 4:

```bash
psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_isolation.sql
```

Cada suite:

1. Siembra dos organizaciones, dos admins y un cliente dentro de una
   transacción.
2. Cambia el rol activo a `authenticated` y fija `request.jwt.claims.sub`
   por cada usuario simulado.
3. Ejecuta cada aserción con `RAISE EXCEPTION` al primer fallo.
4. Hace `ROLLBACK` al final para no dejar residuos.

⚠️ No ejecutar contra producción — siembra registros temporales.

## Cómo añadir nuevos tests

Agrega un bloque dentro del `DO $$ ... $$` del archivo principal:

```sql
PERFORM pg_temp.as_user(user_a);
SELECT COUNT(*) INTO visible_count FROM public.<tabla> WHERE <filtro>;
PERFORM pg_temp.assert(visible_count = <esperado>,
  '<mensaje de error>');
```

Mantener cada caso pequeño y autónomo. Si una nueva tabla con
`organization_id` se agrega al esquema, añadir mínimo un test de lectura
cruzada entre Org A y Org B.
