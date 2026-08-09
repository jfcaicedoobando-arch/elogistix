# Arreglar el fixture de `guard_estado_cotizacion.sql`

## Qué pasa

La prueba crea una cotización de prueba **sin conceptos de venta** (importe cero) y luego intenta pasarla a "Enviada". Existe una regla de negocio (trigger `_cotizaciones_bloquear_envio_sin_importes`) que impide enviar una cotización sin importes capturados, así que el trigger hace exactamente su trabajo: el error es del dato de prueba, no del sistema.

## Qué cambiar

Solo el archivo de prueba `supabase/tests/guard_estado_cotizacion.sql`:

- Al insertar la cotización de prueba, incluir un concepto de venta con importe (por ejemplo 1 x 1000 USD) para que tenga total mayor a cero.
- No se toca el trigger ni ninguna regla de negocio: la validación de "no enviar sin importes" se mantiene intacta y la prueba seguirá cubriendo las transiciones C5 (Vencida → Archivada) y A3 (reactivación).

## Detalle técnico

En el `INSERT INTO public.cotizaciones ...` agregar la columna `conceptos_venta` con un arreglo jsonb compatible con `public.cotizacion_totales_conceptos`:

```json
[{"descripcion":"FLETE GUARD","cantidad":1,"precio_unitario":1000,"moneda":"USD","aplica_iva":false}]
```

Con eso `total_usd = 1000` y la transición Vencida → Enviada pasa el guard.

Nota: al ejecutarlo en este entorno la prueba se detiene más adelante por permisos del rol restringido de psql (no puede hacer `UPDATE`); en CI corre con rol privilegiado y sí ejecuta completa.

Después del cambio: bump de `APP_VERSION` a 13.469.2 y entrada en `CHANGELOG.md`.
