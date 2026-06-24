## Causa raíz

Analogía: tienes una función que sólo entiende "texto plano", pero algunos clientes le hablan en un "dialecto" (el enum `tipo_operacion`). Cuando le hablan en dialecto, no la encuentra y revienta con `function public.generar_expediente(tipo_operacion) does not exist`.

Concretamente:
- En BD sólo existe `public.generar_expediente(tip_op text)`.
- Hay dos rutas que la invocan:
  1. **Cliente** `src/features/cotizacion/services/conversiones/embarques.ts:63` hace `supabase.rpc("generar_expediente", { tipo_op: cotizacion.tipo })`. Supabase-js infiere el tipo del argumento como el enum `tipo_operacion` (porque la columna `cotizaciones.tipo` es de ese enum en los tipos generados) y PostgREST no encuentra la firma.
  2. **SQL** `crear_embarque_borrador_desde_cotizacion(uuid)` ya fue parcheada en 13.135.19 con `v_cot.tipo::text` (fix puntual).

El bundle del error (13.135.14) es previo al parche del cliente, pero la próxima vez que cualquier caller pase el enum sin castear, vuelve a tronar. Necesitamos una solución **a prueba de balas** que no dependa de que cada call site se acuerde de castear.

## Solución

Agregar una **sobrecarga** de `generar_expediente` que acepte el enum `tipo_operacion` directamente y delegue a la versión `text`. Así cualquier caller (cliente con supabase-js o SQL futuro) funciona sin cast.

### Cambios

1. **Migración SQL** — nueva función:
   ```sql
   CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op public.tipo_operacion)
   RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public
   AS $$ SELECT public.generar_expediente(tipo_op::text) $$;
   GRANT EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) TO authenticated, service_role;
   ```
   (la versión `text` original queda intacta, no rompe nada).

2. **Defensa adicional en cliente** — `src/features/cotizacion/services/conversiones/embarques.ts` línea 63: convertir explícitamente a `String(cotizacion.tipo)` para que aunque alguien borre la sobrecarga, siga funcionando.

3. **Versión + changelog**
   - `src/constants/appVersion.ts` → `13.135.28`
   - `CHANGELOG.md` → entrada `[13.135.28]` describiendo el fix.

## Validación

- Confirmar en `pg_proc` que ahora existen **dos** firmas de `generar_expediente`.
- Reproducir el flujo: cotización Aceptada → "Crear embarque" → la revalidación de tarifa ya no debe arrojar el error.

## Fuera de alcance

- No tocamos la lógica de revalidación ni los demás RPCs.
- No tocamos permisos, RLS, ni la firma de 4 args de `crear_embarque_borrador_desde_cotizacion`.
