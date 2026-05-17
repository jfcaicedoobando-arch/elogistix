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

## Cómo correrlos

Desde un entorno con `psql` y `DATABASE_URL` apuntando a la base de pruebas:

```bash
psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_isolation.sql
```

El script:

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
