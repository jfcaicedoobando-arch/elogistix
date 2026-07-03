## Problema

Al convertir una proforma a factura, el RPC intenta guardar `origen_factura = 'conversion_proforma'`, pero ese valor no existe en el enum de la base de datos (`{proforma, manual}`). Postgres rechaza el insert con `22P02` y la conversión falla.

Analogía: el RPC intenta anotar "vino de conversión de proforma" en una casilla que sólo acepta dos etiquetas predefinidas — y esa etiqueta nueva no está en la lista, así que la base de datos lo rechaza.

## Solución

Agregar el valor faltante al enum vía migración:

```sql
ALTER TYPE origen_factura ADD VALUE IF NOT EXISTS 'conversion_proforma';
```

No hay que tocar el RPC ni el frontend: los cuatro llamados en migraciones ya usan la cadena correcta, sólo faltaba el valor en el enum.

## Cambios

1. Nueva migración que agrega `conversion_proforma` al enum `origen_factura`.
2. Bump `APP_VERSION` a `13.146.2` + entrada en `CHANGELOG.md`.

## Riesgo

Mínimo. `ALTER TYPE ... ADD VALUE` es aditivo y no rompe filas existentes (siguen siendo `proforma` o `manual`).
