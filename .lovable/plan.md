## Problema

La RPC `crear_embarque_borrador_desde_cotizacion` está duplicada en la base de datos:

1. **Overload de 1 argumento** (versión original): `(p_cotizacion_id uuid)`
2. **Overload de 4 argumentos con DEFAULTs** (agregada en la migración del 19-jun): `(p_cotizacion_id uuid, p_decision text DEFAULT 'sin_cambios', p_tarifa_id_aplicada uuid DEFAULT NULL, p_delta_jsonb jsonb DEFAULT NULL)`

Como los 3 argumentos extra tienen `DEFAULT`, cuando alguien llama a la función pasando sólo `p_cotizacion_id`, Postgres encuentra **dos candidatos válidos** (la de 1 arg y la de 4 args con defaults) y aborta con:

> `function public.crear_embarque_borrador_desde_cotizacion(uuid) is not unique`

Esto rompe:
- El flujo "Generar embarque" desde el detalle de cotización (lo que vio el usuario en Sentry).
- La llamada interna de la propia función de 4 args (línea 147 de la migración), que invoca `crear_embarque_borrador_desde_cotizacion(p_cotizacion_id)` recursivamente con un solo argumento.

**Analogía:** es como tener dos botones idénticos en la app llamados "Guardar" — cuando le pides al sistema "presiona Guardar" no sabe a cuál te refieres.

## Solución

Quitar los `DEFAULT` de los 3 argumentos opcionales del overload de 4 args. Así:
- La llamada con 1 uuid resuelve **únicamente** al overload viejo.
- La llamada con 4 args resuelve **únicamente** al overload nuevo (que es como ya lo invoca `crearEmbarqueBorradorConDecision` en `src/features/cotizacion/services/revalidacion/index.ts` — siempre pasa los 4).
- La llamada interna recursiva sigue funcionando porque pasa un solo argumento.

Sin cambios de comportamiento, sin tocar RLS, sin renombrar la función, sin tocar el cliente.

## Cambios

1. **Nueva migración** `supabase/migrations/<timestamp>_fix_overload_crear_embarque.sql`:
   ```sql
   DROP FUNCTION IF EXISTS public.crear_embarque_borrador_desde_cotizacion(uuid, text, uuid, jsonb);

   CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(
     p_cotizacion_id      uuid,
     p_decision           text,
     p_tarifa_id_aplicada uuid,
     p_delta_jsonb        jsonb
   ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
   -- mismo cuerpo que la migración 20260619230147 (sin DEFAULTs)
   $$;

   GRANT EXECUTE ON FUNCTION
     public.crear_embarque_borrador_desde_cotizacion(uuid, text, uuid, jsonb)
     TO authenticated, service_role;
   ```

2. **`src/constants/appVersion.ts`** → `13.135.14`.

3. **`CHANGELOG.md`** → entrada `13.135.14` describiendo el fix del overload ambiguo.

4. **Sentry** → marcar el issue como resuelto una vez aplicada la migración.

## Verificación

Después de migrar, correr:
```sql
SELECT pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE proname='crear_embarque_borrador_desde_cotizacion';
```
Esperado: dos filas, una `p_cotizacion_id uuid` y otra `p_cotizacion_id uuid, p_decision text, p_tarifa_id_aplicada uuid, p_delta_jsonb jsonb` — **ninguna con `DEFAULT`** en el segundo resultado.

Luego, desde la app: abrir una cotización y dar "Generar embarque" — debe crear el borrador sin el error.
