# Fix: `conceptos_costo_origen_check` bloquea ajustes de factura de proveedor

## Qué pasó (analogía)

Tu cuaderno de gastos tiene dos reglas separadas para cada renglón:

1. **Regla del signo del monto** (`conceptos_costo_monto_signo`) — dice qué tipos de renglón pueden ir en negativo.
2. **Regla del tipo de renglón** (`conceptos_costo_origen_check`) — dice qué "etiquetas de origen" están permitidas.

En `v13.307.8` actualizamos la **regla 1** para permitir montos negativos cuando el origen es `ajuste_factura_proveedor` (para los descuentos del proveedor)… pero se nos olvidó agregar esa etiqueta a la **regla 2**. Resultado: el guardado de la factura funciona, pero cuando el sistema intenta crear el renglón de ajuste al vuelo, la BD lo rechaza con `conceptos_costo_origen_check`.

Por eso saliste con dos toasts: el verde de "Factura 0046 creada" y el rojo persistente de "los ajustes de costo fallaron".

## Estado actual (verificado)

- `conceptos_costo_origen_check` permite hoy: `manual`, `demoras_auto`, `cotizacion`, `costeo_tarifa`.
- El código (`crearAjustesFacturaProveedor.ts`) y el trigger de reversión (`tg_reverse_ajustes_factura_proveedor`) ya asumen `origen = 'ajuste_factura_proveedor'`.
- Falta únicamente ampliar el CHECK del origen.

## Cambios

### Migración (schema)

Reemplazar `conceptos_costo_origen_check` para incluir `ajuste_factura_proveedor`:

```sql
ALTER TABLE public.conceptos_costo
  DROP CONSTRAINT conceptos_costo_origen_check;

ALTER TABLE public.conceptos_costo
  ADD CONSTRAINT conceptos_costo_origen_check
  CHECK (origen = ANY (ARRAY[
    'manual',
    'demoras_auto',
    'cotizacion',
    'costeo_tarifa',
    'ajuste_factura_proveedor'
  ]));
```

Sin backfill: no hay filas con ese origen todavía (por eso justamente fallaba la inserción).

### Reintento del ajuste para FP-000046

Después de aplicar la migración, la factura 0046 ya quedó guardada pero **sin** los renglones de ajuste, así que la utilidad del embarque vinculado sigue calculada contra el costo devengado original. Opciones:

- **A (recomendada):** Abrir FP-000046, entrar a "Vincular embarque", y guardar de nuevo. El servicio es idempotente y creará los ajustes esta vez.
- **B:** Dejarla como está si la diferencia entre devengado y facturado no es material.

Confirmamos contigo cuál prefieres al terminar la migración.

### Versión / changelog

- `APP_VERSION` → `13.307.13`.
- Entrada en `CHANGELOG.md` explicando el CHECK faltante y el fix.

## Fuera de alcance

- No se toca la lógica de `crearAjustesFacturaProveedor.ts` ni el trigger de reversión — ambos ya son correctos.
- No se cambia el toast de "best-effort" (ya tiene `duration: Infinity` desde `v13.307.8`).
