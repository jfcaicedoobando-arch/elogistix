# Fix — Hector ve menos de lo que debería tras el backfill de roles

## Causa raíz

Hector tiene **dos filas** en `public.user_roles`: `admin_org` y `customer_service`. Es residuo histórico de cuando tenía `admin` + `viewer` (ambos se migraron en la 12.66.0).

La función SQL `public.get_user_context` (la que alimenta `useAuthProfile` en el frontend) hace:

```sql
SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
```

Sin `ORDER BY`. Postgres es libre de devolver cualquier fila — en este caso le toca `customer_service`, que es el rol más restrictivo del catálogo y por eso se le ocultan Usuarios, Cotizaciones y Embarques (Edición).

Solo Hector tiene este duplicado (revisé toda la tabla), así que el daño está acotado, pero el bug latente está en la función y debemos cerrarlo para que no vuelva a pasar con otro usuario.

## Cambios

### 1. Migración SQL (un solo archivo)

**a) Deduplicar `user_roles` por prioridad.** Conservar la fila con el rol más privilegiado por usuario y borrar las demás. Orden de prioridad (mayor → menor):

```
super_admin > admin_org > admin > gerente_operaciones > contador > tesorero >
ejecutivo_pricing > coordinador_logistico > operador > vendedor >
customer_service > viewer > cliente
```

**b) Agregar restricción única** `UNIQUE (user_id)` en `public.user_roles` para que nunca más se inserten dos roles para el mismo usuario. (Si en el futuro se quiere multi-rol, se hace explícito con otra estructura.)

**c) Reescribir `public.get_user_context`** con `ORDER BY` por prioridad usando un `CASE` (defensa en profundidad por si en el futuro se relaja el UNIQUE):

```sql
ORDER BY CASE role
  WHEN 'super_admin' THEN 1
  WHEN 'admin_org' THEN 2
  WHEN 'admin' THEN 3
  ...
END
LIMIT 1
```

Mismo `ORDER BY` se aplica a `orgRole` desde `organization_members` por simetría.

### 2. Sin cambios en el frontend

`usePermissions`, sidebar y `roleCatalog` ya manejan correctamente `admin_org`. Una vez que el RPC devuelva el rol correcto, Hector recuperará el acceso al instante (el TTL del `useAuthProfile` es 60s — puede refrescar o cerrar/abrir sesión).

### 3. Versionado y changelog

- `APP_VERSION` → `12.66.1` (patch).
- Entrada en `CHANGELOG.md`: "fix(seguridad) — `user_roles` ahora único por usuario; `get_user_context` ordena por prioridad de rol".

## Verificación

1. `SELECT user_id, count(*) FROM user_roles GROUP BY 1 HAVING count(*) > 1` → vacío.
2. `SELECT get_user_context()` impersonando a Hector → `role: 'admin_org'`.
3. Pedirle a Hector que recargue (Ctrl-F5) y confirme que vuelve a ver Usuarios / Cotizaciones / Embarques con edición.

¿Procedo?
