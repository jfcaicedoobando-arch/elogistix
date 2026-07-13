## Contexto

El job **"Prepare RLS database snapshot"** falla en CI al replayar migraciones sobre un Postgres limpio:

```
ERROR:  relation "public.embarque_consecutivo_seq" does not exist
QUERY:  SELECT last_value FROM public.embarque_consecutivo_seq
en migración: 20260713165742_20aea6c0-...sql
```

Como el error interrumpe el replay, la suite RLS queda `skipped` y `0_RLS tests result` falla con exit 1.

## Causa

La secuencia `public.embarque_consecutivo_seq` existe en producción desde hace mucho (migración pre-historial), pero **nunca aparece con `CREATE SEQUENCE`** en el repositorio. Las migraciones antiguas solo la usan con `nextval(...)` dentro de cuerpos de función (que no se resuelve hasta que se llama a la función, así que no rompen el replay).

La migración `20260713165742_...sql` (agregada esta sesión al arreglar `generar_expediente` multi-tenant) hace `SELECT last_value FROM public.embarque_consecutivo_seq` **dentro de un `DO $$ ... $$` que sí se ejecuta al momento del replay** → error inmediato en CI.

Ya existe una migración posterior (`20260713190941_...sql`) con `CREATE SEQUENCE IF NOT EXISTS`, pero corre **después** de la que falla, así que no ayuda al snapshot.

## Fix

Editar `supabase/migrations/20260713165742_20aea6c0-6aec-423b-b0a2-41ac714ec50e.sql` para anteponer, antes del bloque `DO`:

```sql
-- Guard idempotente: la secuencia existe en prod desde el pre-historial,
-- pero en un replay limpio (CI RLS snapshot) todavía no ha sido creada.
CREATE SEQUENCE IF NOT EXISTS public.embarque_consecutivo_seq;
```

Es idempotente y seguro en producción (no-op si ya existe).

## Verificación

- Typecheck no aplica (solo SQL).
- El siguiente `Prepare RLS database snapshot` en CI debe pasar de `165742 → 165828 → 190941` sin abortar.
- No tocar la migración `20260713190941` (queda como red de seguridad).

## Entregables

1. Editar `supabase/migrations/20260713165742_20aea6c0-6aec-423b-b0a2-41ac714ec50e.sql`: insertar `CREATE SEQUENCE IF NOT EXISTS` al inicio.
2. Bump `APP_VERSION` a `13.292.1`.
3. Entrada en `CHANGELOG.md` describiendo el hotfix.

## Analogía (para principiantes)

Imagina que tienes una receta que dice "toma la sal del frasco" pero nunca dijo cuándo comprar el frasco. En tu cocina real ya hay uno, así que funciona. Pero cuando un amigo intenta cocinar en una cocina vacía, se atora. La corrección es agregar al inicio: "si no tienes frasco, compra uno" — no rompe nada si ya lo tenías.
