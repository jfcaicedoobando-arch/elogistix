## Problema

La RPC `crear_embarque_borrador_core` (parchada ayer en v13.319.2) ahora truena con `column p.nombre does not exist` al revalidar tarifa.

## Causa

La versión parchada asumió columnas `unlocode` y `nombre` en `public.puertos`, pero la tabla real tiene:

- `code` (no `unlocode`)
- `name` (no `nombre`)

Analogía: arreglamos la puerta pero pusimos la manija con los tornillos equivocados — la puerta sigue sin abrir.

Líneas problemáticas dentro de la función:

```sql
SELECT p.nombre INTO v_puerto_o FROM public.puertos p WHERE p.unlocode = v_origen_code LIMIT 1;
SELECT p.nombre INTO v_puerto_d FROM public.puertos p WHERE p.unlocode = v_destino_code LIMIT 1;
```

## Fix

Migración que redefine `crear_embarque_borrador_core` cambiando esas dos consultas por:

```sql
SELECT p.name INTO v_puerto_o FROM public.puertos p WHERE p.code = v_origen_code LIMIT 1;
SELECT p.name INTO v_puerto_d FROM public.puertos p WHERE p.code = v_destino_code LIMIT 1;
```

Sin otros cambios de lógica.

## Auditoría de contagio

Revisé las otras dos funciones que usan `p.nombre` (`busqueda_global`, `proveedores_listado`) — allí `p` es alias de `proveedores` (que sí tiene columna `nombre`), no de `puertos`. Falsos positivos, no requieren cambio.

## Entregables

- Migración con `CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_core` corregida.
- Bump `APP_VERSION` a `13.319.3`.
- Entrada en `CHANGELOG.md`.
