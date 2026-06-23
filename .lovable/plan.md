## Problema confirmado

El dashboard está vacío porque el RPC `dashboard_summary` regresa **HTTP 400** con:

```
invalid input value for enum tipo_contable_categoria: "IndirectoOperacion"
```

(Visible en los network logs del preview, request a `/rpc/dashboard_summary`.)

La migración 13.114.6 renombró el valor del enum `IndirectoOperacion → Venta`, pero la función `dashboard_summary` quedó con el literal viejo hardcodeado. Es la única función del sistema que aún lo referencia.

## Cambio propuesto

**Migración** que recrea `public.dashboard_summary()` con un único cambio en su WHERE:

```diff
- WHERE pc.tipo_contable IN ('IndirectoOperacion','Administracion')
+ WHERE pc.tipo_contable IN ('Venta','Administracion')
```

Todo el resto del cuerpo de la función se preserva tal cual (mismas firmas, mismos JOINs, mismo retorno).

## Versionado y changelog

- `APP_VERSION` → `13.114.8` (la 13.114.7 acaba de cerrarse para el fix de las suites RLS de CI).
- Entrada en `CHANGELOG.md` describiendo: causa raíz (enum renombrado), efecto (dashboard vacío + 400 en `dashboard_summary`), fix (un literal), y analogía.

## Verificación

1. `SELECT public.dashboard_summary()` vía psql → debe regresar JSON sin error.
2. Recargar `/inicio` en el preview → confirmar que reaparecen los timelines, próximos arribos y barras de utilidad.

## Analogía

La etiqueta de la caja se cambió de "Indirecto Operación" a "Venta" en toda la bodega, pero la lista de pedidos del contador (`dashboard_summary`) todavía pedía la caja vieja. Cuando el dashboard preguntaba, el contador respondía "no existe" y se devolvía con las manos vacías — por eso no veías ningún embarque.
