## Diagnóstico verificado

La cotización `6bee80b9…` está sin cambios de tarifa, así que el frontend intenta crear el embarque directo llamando `crear_embarque_borrador_desde_cotizacion` → que a su vez invoca `crear_embarque_borrador_core`.

Confirmé con `psql`:

- La tabla `public.cotizaciones` **sólo** tiene las columnas `origen` y `destino` para la ruta (no `puerto_origen`, `aeropuerto_origen`, `ciudad_origen`, ni sus equivalentes de destino).
- La función `crear_embarque_borrador_core` (única con `v_cot.puerto_origen` en su cuerpo) hace:

```sql
v_origen_code  := COALESCE(v_cot.puerto_origen,  v_cot.aeropuerto_origen,  v_cot.ciudad_origen);
v_destino_code := COALESCE(v_cot.puerto_destino, v_cot.aeropuerto_destino, v_cot.ciudad_destino);
```

Como `v_cot` es `cotizaciones%ROWTYPE`, Postgres lanza el error exacto que ve el usuario: `record "v_cot" has no field "puerto_origen"`. Por eso el botón "Crear embarque" con severidad `sin_cambios` truena bajo el label `REVALIDAR_TARIFA` en el toast.

Analogía: la receta pide "sacar el jitomate del cajón `puerto_origen`" pero ese cajón ya no existe — sólo hay uno que se llama `origen`. El cocinero se planta y no sirve el platillo.

## Alcance del fix

Editar únicamente la función `public.crear_embarque_borrador_core` para leer la ruta desde las columnas reales de `cotizaciones`. El resto de la lógica (resolver UN/LOCODE → nombre de puerto, decidir puerto vs. aeropuerto vs. ciudad según `modo`, insert en `embarques`) se preserva intacta.

Cambios puntuales dentro de la función:

```sql
-- antes
v_origen_code  := COALESCE(v_cot.puerto_origen,  v_cot.aeropuerto_origen,  v_cot.ciudad_origen);
v_destino_code := COALESCE(v_cot.puerto_destino, v_cot.aeropuerto_destino, v_cot.ciudad_destino);

-- después
v_origen_code  := v_cot.origen;
v_destino_code := v_cot.destino;
```

No se tocan los `INSERT INTO public.embarques (puerto_origen, puerto_destino, aeropuerto_origen, …)` porque la tabla `embarques` sí tiene esas columnas — las asigna la lógica de más abajo según `v_cot.modo`.

## Verificación post-cambio

1. Re-ejecutar la RPC `crear_embarque_borrador_desde_cotizacion` para la cotización `6bee80b9-9b5b-4f1b-98cb-b2ddc77da9b3` con `p_decision='sin_cambios'` desde un cliente autenticado (o vía el botón de la UI): debe devolver el UUID del embarque en lugar del error 42804.
2. Confirmar en la tabla `embarques` que el nuevo registro tiene `puerto_origen`/`puerto_destino` (o su equivalente aéreo/terrestre) poblados a partir de `origen`/`destino` de la cotización.
3. `bun run lint` y suite de tests de `revalidacion/__tests__/index.test.ts` para asegurar que no hay regresión de contrato.

## Fuera de alcance (para no inflar el fix)

Detecté que **otras 14 funciones** (`crear_embarque_completo`, `duplicar_embarque_completo`, `dashboard_stats`, `operaciones_stats`, `obtener_top_tarifas`, `get_tracking_public`, `dashboard_details`, `agente_aprobar_tarifa`, `embarques_listado`, `seed_demo_organization`, `get_top_tarifas`, `get_agente_rutas`, `actualizar_embarque_completo`) también mencionan `puerto_origen`. La mayoría opera sobre la tabla `embarques` (donde la columna sí existe) y no sobre `cotizaciones`, así que no rompen — pero conviene barrerlas en un fix posterior si quieres. Pregúntame si quieres que lo audite como paso 2.

## Changelog + versión

- Bump `APP_VERSION` a `13.319.2`.
- Entrada en `CHANGELOG.md`: "fix · Crear embarque desde cotización ya no truena con `record 'v_cot' has no field 'puerto_origen'`. La RPC ahora lee `origen`/`destino` directamente de la cotización (que es donde vive el dato)."
- Resolver el finding correspondiente en Project monitoring como `fixed` (si aplica).
