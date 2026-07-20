## Diagnóstico

CI vuelve a caer en el snapshot RLS con:

```
ERROR: column c.dias_almacenaje does not exist
▶ 20260720222427_9c9f2a48....sql
```

Estado real del repo:

- `20260720222427` ya está limpia (0 referencias a `dias_almacenaje`) — el fix previo (v13.303.24) sí está en disco. Ese ERROR proviene de un run de CI encolado con la versión anterior. Un re-run limpiaría 222427.
- **Pero hay una bomba de tiempo real**: `20260720222825` y `20260720223911` definen `crear_embarque_borrador_core` con `INSERT ... VALUES (..., v_cot.dias_almacenaje, ...)`. La columna `cotizaciones.dias_almacenaje` **no existe en la secuencia de migraciones** (sólo se agregó a `embarques` en `20260616071906`, y luego se metió a mano a `cotizaciones` en producción).
  - Consecuencia CI: las funciones se crean sin error (plpgsql no valida columnas al `CREATE`), pero al primer llamado real revientan igual que el UPDATE viejo.
  - Consecuencia producción: hoy funciona sólo porque la columna se agregó fuera de migraciones — cualquier restore/entorno nuevo queda roto.

## Fix

**Nueva migración** que empareja `cotizaciones` con los campos ya presentes en `embarques` (todos los que las RPC `v_cot.*` esperan):

```sql
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS dias_almacenaje integer NOT NULL DEFAULT 0;
```

Auditar en la misma migración los otros campos que las RPCs leen de `v_cot` y confirmar con `information_schema` que ya existen (`carta_garantia`, `dias_libres_destino`, `seguro`, `valor_seguro_usd`, `tarifa_id`). Si alguno faltara, se agrega con `IF NOT EXISTS`.

Con esto:

- CI snapshot deja de depender del re-run: la columna existe cuando las funciones se llamen y el UPDATE de 222427 (ya limpio en disco) no reintroduce el bug.
- Entornos nuevos (staging fresh, RLS tests) quedan consistentes con producción.

## Entregables

1. `supabase/migrations/<timestamp>_align_cotizaciones_columnas_tarifa.sql` — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (idempotente, no toca datos).
2. Bump `APP_VERSION` → `13.303.29`.
3. Entrada en `CHANGELOG.md` explicando el desfase snapshot vs. producción y el hardening.

Sin cambios de UI ni de lógica de negocio.

## Analogía

Producción tenía un cuarto extra que se construyó "por fuera del plano". Cuando el CI reconstruye la casa desde los planos oficiales, ese cuarto no aparece y las tuberías (RPC) que llegan hasta ahí revientan. Esta migración añade el cuarto al plano oficial.
