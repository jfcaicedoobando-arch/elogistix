## Contexto

En v13.319.2 arreglamos `crear_embarque_borrador_core`, que leía `v_cot.puerto_origen / aeropuerto_origen / ciudad_origen` cuando la tabla `cotizaciones` solo tiene `origen` y `destino`. Este plan documenta la auditoría que hicimos para verificar si el mismo bug (leer columnas inexistentes de `cotizaciones`) aparece en otro lado.

## Hallazgos de la auditoría

**Columnas reales en `public.cotizaciones`** (confirmado con `information_schema`): solo `origen` y `destino`. NO existen `puerto_origen`, `puerto_destino`, `aeropuerto_origen`, `aeropuerto_destino`, `ciudad_origen`, `ciudad_destino` en cotizaciones — esas viven únicamente en `public.embarques`.

**Funciones SQL revisadas** (busqué en todas las funciones de `public` que tocan `cotizaciones` y mencionan alguna de las 6 columnas problemáticas):

1. `crear_embarque_borrador_core` — ya corregida en v13.319.2. ✅
2. `seed_demo_organization` — **falso positivo**. Usa `puerto_origen` / `aeropuerto_origen` solo dentro de `INSERT INTO public.embarques (...)`, donde esas columnas sí existen. El `INSERT INTO public.cotizaciones` usa correctamente `origen, destino`. ✅

**Frontend / edge functions**: búsqueda por patrón `cotizacion*.puerto_origen|aeropuerto_origen|ciudad_origen` en `src/` y `supabase/` — 0 resultados. ✅

**Búsqueda extra por `v_cot.puerto_ / aeropuerto_ / ciudad_`** en migraciones históricas: 0 resultados adicionales. ✅

## Conclusión

El bug estaba aislado a `crear_embarque_borrador_core`. No hay que tocar más funciones ni código. No requiere migración ni cambio de código.

## Siguiente paso propuesto

Ninguno — cerrar el hilo. Si quieres, puedo:
- **Opción A**: dejarlo así y no hacer cambios (recomendado).
- **Opción B**: agregar un test de regresión en `supabase/tests/` que llame `crear_embarque_borrador_core` sobre una cotización semilla y verifique que no truena, para atrapar regresiones si alguien reintroduce el bug al reescribir la RPC.

Confirma cuál prefieres y salimos de modo plan.
