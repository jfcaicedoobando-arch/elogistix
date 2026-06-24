## Problema (analogía)

La RPC `crear_embarque_borrador_desde_cotizacion` le entrega a `generar_expediente` un dato de tipo "enum" (`tipo_operacion`), pero la función receptora espera un `text`. Es como meter una llave de tubo en un enchufe eléctrico: encajan visualmente pero Postgres se planta y devuelve `function public.generar_expediente(tipo_operacion) does not exist`. Sentry lo reportó 2 veces hoy en `/cotizaciones/...` (release 13.135.14) al intentar convertir una cotización aceptada en borrador de embarque.

## Fix

Una nueva migración que recrea `crear_embarque_borrador_desde_cotizacion` cambiando una sola línea:

```text
v_expediente := public.generar_expediente(v_cot.tipo);
                ↓
v_expediente := public.generar_expediente(v_cot.tipo::text);
```

Conservamos el resto del cuerpo idéntico (validaciones, contenedores, conceptos, bitácora, notificaciones).

## Pasos

1. Crear migración `supabase/migrations/<timestamp>_fix_crear_embarque_borrador_cast_tipo.sql` con `CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(uuid) ...` aplicando el cast `::text`. Re-otorgar `GRANT EXECUTE ... TO authenticated`.
2. Subir versión: `src/constants/appVersion.ts` → `13.135.19`.
3. Entrada en `CHANGELOG.md` describiendo el fix.
4. Marcar resuelto el issue `JAVASCRIPT-REACT-1J` (y su gemelo `1H`) en Sentry tras desplegar.

## Riesgo

Mínimo. Sólo se cambia un cast dentro de una RPC ya existente; no toca tablas, RLS, triggers ni firmas. Los tests existentes (`embarques.test.ts`, `documentos.test.ts`) mockean la RPC, así que siguen verdes.
