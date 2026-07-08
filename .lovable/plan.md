## Objetivo

Revertir la proforma **PRO-2026-0957** (id `6a629563-b73b-4f5c-ae2c-8017a655ef6e`) del estado `facturada` (huérfana) al estado `aceptada`, para que puedas convertirla a factura desde la app.

## Cambio puntual

Un solo `UPDATE` en `public.proformas` filtrado por `id`:

- `estado_proforma` → `'aceptada'`
- `factura_id` → `NULL` (ya está NULL, por seguridad)
- `folio_factura_externa` → `NULL` (ya está NULL, por seguridad)

No se toca ninguna otra proforma, ni código, ni esquema, ni versión.

## Analogía

Es como tachar el sello de "facturado" en un recibo que nunca se facturó de verdad, y devolverlo a la bandeja de "listo para facturar". El resto de los recibos del archivero no se tocan.

## Verificación

Después del update, consulto la fila para confirmar `estado_proforma = 'aceptada'` y que sigue sin factura enlazada. Tú luego la conviertes desde la UI.

## Fuera de alcance

- Las otras 178 proformas huérfanas — quedan como están hasta que decidas.
- CHANGELOG / bump de versión — es un fix puntual de datos, no cambio de app.
