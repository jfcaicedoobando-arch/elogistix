# Limpieza de facturas de prueba F950, F952 y F953

## Qué encontré

Las tres facturas están vencidas y fueron timbradas en modo de prueba (sandbox):

| Factura | Cliente | Importe | Vencimiento |
| --- | --- | --- | --- |
| F950 | KUARTZ SURFACES AND KITCHENS | 3,481.00 USD | 03/07/2026 |
| F952 | QUIMCELT POWDER COATINGS | 47,560.00 MXN | 02/08/2026 |
| F953 | QUIMCELT POWDER COATINGS | 24,500.00 MXN | 19/07/2026 |

Ninguna tiene pagos registrados, así que se pueden cancelar sin revertir nada.

## Qué voy a hacer

Cancelar exactamente esas tres facturas, dejando registrado el motivo "Factura de prueba (timbrado en ambiente sandbox)" y la fecha de cancelación. Con eso salen del listado de vencidas y del cálculo de cobranza, sin registrar dinero que nunca se cobró.

No se toca ninguna otra factura, ni los importes, ni el sello fiscal, ni los embarques ligados más allá del efecto normal que ya existe cuando una factura se cancela.

## Detalles técnicos

- Cambio de datos únicamente (herramienta de datos, sin migración ni SQL de estructura): `UPDATE public.facturas SET estado = 'Cancelada', cancelacion_motivo = ..., cancelado_en = now()` filtrando por los tres UUID exactos.
- Compatible con los guardas existentes: `guard_estado_factura` permite pasar a `Cancelada` porque no hay pagos vivos, y `bloquear_modificacion_factura_emitida` admite explícitamente la transición a `Cancelada` sin tocar identidad fiscal ni totales.
- Los disparadores de bitácora, comisiones y estado del embarque corren por sí solos, como en cualquier cancelación.
- Sin cambios de código, sin dependencias, sin publicar. CHANGELOG y manifiesto no aplican porque no hay migración ni versión de app involucrada.

## Verificación

Consultar las tres facturas después del cambio y confirmar que quedaron en `Cancelada` y que el conteo de vencidas bajó de 18 a 15.
