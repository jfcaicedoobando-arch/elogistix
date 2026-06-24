## Causa raíz

La migración `20260623214746_…sql` crea un usuario demo (`agente.demo@librecarga.com`) insertando **directo** en `auth.users` y referencia la columna `instance_id`. En el ambiente de CI (Postgres fresco o versión nueva de Supabase auth) esa columna no existe → el INSERT explota:

```
ERROR: column "instance_id" of relation "users" does not exist
```

Tocar `auth.users` desde migraciones es frágil — Supabase no garantiza el esquema interno entre versiones. La data ya existe en producción, así que la migración sólo necesita correr "best effort" en fresh installs sin romper.

**Analogía:** la migración intenta meter una llave en una cerradura que cambió de modelo; mejor que toque solo si encaja, y si no, que siga de largo sin romper la puerta.

## Cambio

Reemplazar la migración por una versión defensiva que:

1. **Aborte temprano** si `auth.users` no existe (entorno sin auth schema): `IF to_regclass('auth.users') IS NULL THEN RETURN; END IF;`
2. **Construya el INSERT dinámicamente** con `EXECUTE format(...)`, incluyendo `instance_id` SOLO si la columna existe en `information_schema.columns`. Lo mismo para `confirmation_token`, `recovery_token`, etc. (cualquiera puede ser eliminada en versiones futuras).
3. Mantenga la lógica idempotente de `user_roles` y `agente_users` (esa parte ya estaba bien y no toca `auth.*`).

No tocamos las otras migraciones (ya corrieron OK). Sólo reescribimos el archivo problemático en sitio — sigue siendo idempotente, así que correrlo otra vez no rompe nada en producción.

## Fuera de alcance
- Cambiar la estrategia de seed de usuarios demo (sería mejor moverlo a un script de seed fuera de migrations, pero queda como tarea aparte).
- Otras migraciones de la lista — todas terminaron en 0–1s sin error.
