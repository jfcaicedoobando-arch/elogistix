# Factura que no timbra por la fecha del día anterior

## Qué está pasando

El aviso que viste ("La factura tiene fecha 2026-09-17 y hoy es 2026-09-18…") ya no existe en el código actual: ese bloqueo se quitó y se reemplazó por el ajuste automático de fecha antes de timbrar.

El reporte llegó de la versión **13.824.2** en el sitio en vivo, y la versión ya corregida es la **13.824.3**, que todavía no está publicada. Es decir: la corrección está hecha, pero el sitio que usa Karol sigue ejecutando la versión anterior.

## Qué propongo hacer

1. Publicar la versión actual para que el sitio en vivo tome el ajuste automático de fecha.
2. Pedirle a Karol que reintente el timbrado de esa misma factura y confirmar que pasa sin el aviso.
3. Si al reintentar aparece el aviso del tipo de cambio del DOF (mensaje distinto, sobre el tipo de cambio faltante), ese es otro tema y lo revisamos aparte: significa que falta la publicación del DOF del día.

No hace falta tocar código ni volver a cambiar la lógica fiscal.

## Detalle técnico

- El bloqueo vivía en `supabase/functions/facturapi-emitir/emitir.ts` y se eliminó en el commit `c9e185e04`.
- El reemplazo es `supabase/functions/facturapi-emitir/fechaEmision.ts` (`realinearFechaEmision`): mueve `fecha_emision` a hoy (zona `America/Mexico_City`) antes del claim y del PAC, sólo si la factura no está timbrada ni en papelera, deja registro en bitácora y traduce `LC_FACTURA_SIN_TC_DOF` / `LC_FACTURA_TC_DOF_OBSOLETO` a un 422 accionable.
- Las Edge Functions del entorno en vivo se actualizan al publicar; de ahí que el sitio siga devolviendo el mensaje viejo.
- Sin cambios de versión ni de changelog en este paso; la entrada 13.824.3 ya está registrada.
