## Problema

La migración `20260720222427_9c9f2a48-…sql` (parte de v13.303.15) hace referencia a `c.dias_almacenaje` (columna de `cotizaciones`) en dos lugares, pero esa columna **sólo existe en `embarques`**, no en `cotizaciones`. Resultado en CI:

```
ERROR:  column c.dias_almacenaje does not exist
HINT:   Perhaps you meant to reference the column "e.dias_almacenaje".
```

Esto revienta “Prepare RLS database snapshot → Apply migrations”, lo cual salta el job `rls-suites` (queda como `skipped`) y el agregador reporta:

```
##[error]Una o más suites RLS fallaron (resultado: skipped)
```

Columnas realmente existentes en `cotizaciones` (verificado): `carta_garantia`, `dias_libres_destino`, `seguro`, `valor_seguro_usd`. **No** existen `dias_almacenaje` ni `tarifa_id_original`/`tarifa_id_aplicada` en cotizaciones.

## Analogía

Es como copiar campos de un formulario A a otro B usando una etiqueta que sólo vive en B: al leerla del A, Postgres se queja porque ese casillero nunca existió allá.

## Cambios

1. **Nueva migración `supabase/migrations/<timestamp>_fix_crear_embarque_borrador_core_dias_almacenaje.sql`** que:
   - Recrea `public.crear_embarque_borrador_core(uuid)` idéntica a la actual pero eliminando `v_cot.dias_almacenaje` del `INSERT INTO public.embarques`. `dias_almacenaje` en embarques queda en su default (`0`), consistente con el flujo previo a v13.303.15 (no hay origen para ese dato en la cotización).
   - Re-ejecuta el backfill de `COT-2026-0138 → E-ELIMP00333` sin la línea `dias_almacenaje = COALESCE(e.dias_almacenaje, c.dias_almacenaje)` (se conserva el valor actual en embarques).

2. **Bump de versión**: `APP_VERSION` → `13.303.19` + entrada en `CHANGELOG.md` (root) explicando el fix de la migración rota y su impacto (CI RLS suite volvía a rojo).

## Sin cambios

- No se toca UI, ni la RPC en su lógica de negocio (misma firma y comportamiento salvo el campo eliminado).
- No se altera el resto de columnas del backfill (tarifa, carta_garantia, dias_libres_destino, seguro, valor_seguro_usd) — esas sí existen en cotizaciones.
- No se modifica la migración fallida en sitio (la política del repo es migraciones inmutables); se corrige con una migración posterior.

## Verificación esperada

- `Apply migrations` termina en verde.
- Job agregador `RLS tests result` reporta `success`.
- No queda referencia a `c.dias_almacenaje` en `supabase/migrations/` (grep de control).
