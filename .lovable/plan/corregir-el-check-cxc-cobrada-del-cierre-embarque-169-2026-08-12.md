# Corregir el check "CxC cobrada" del cierre (embarque 169)

## Qué está pasando (confirmado en datos)

El embarque 169 tiene una sola factura al cliente: **915, USD 2,910.00, estado "Pagada"**.
Pero en la tabla de pagos **no existe ningún pago aplicado a esa factura** (0 registros vivos).

El checklist de cierre no mira el estado de la factura: calcula el saldo como
`total - pagos aplicados - notas de crédito`. Sin pagos registrados, el saldo sale
2,910 y el check "CxC cobrada" marca "1 factura por cobrar".

Analogía: la factura tiene el sello de "PAGADA" en la portada, pero el libro de caja
no tiene ninguna anotación del depósito. El checklist confía en el libro de caja, no en el sello.

Esto no es exclusivo del 169: hay **31 facturas** en esa misma situación (facturas
legacy que se marcaron como pagadas a mano, sin registrar el pago).

## Qué se va a hacer

1. **Regla del checklist**: en `validar_cierre_embarque`, las facturas con estado
   `Pagada` se consideran saldo 0 para el check de CxC (igual que hoy se ignoran
   Cancelada / Sustituida / Borrador). Así el estado oficial de la factura manda y
   ya no bloquea el cierre.
2. **Consistencia**: aplicar el mismo criterio en el resumen de pendientes
   administrativos (`fetchAdminPendientesResumen` / `embarques_alertas_ids`) para que
   la tarjeta de "Cierre operativo/administrativo" y el checklist digan lo mismo.
3. **Detalle visible**: cuando el saldo venga de facturas legacy marcadas pagadas sin
   pago registrado, el detalle del check mostrará una nota corta ("saldo cubierto por
   estado de la factura") para que Tesorería sepa por qué está en OK.

## Detalles técnicos

- Nueva migración que reemplaza `public.validar_cierre_embarque`: en el CTE `agg` de CxC
  usar `CASE WHEN f.estado = 'Pagada' THEN 0 ELSE public.saldo_factura(f.id) END` tanto
  en el `saldo` como en el conteo `facturas_pendientes`. Sin cambios al resto de checks.
- Actualizar la fuente canónica `supabase/schema/embarques/validar_cierre_embarque.sql`
  en el mismo cambio (regla del repo).
- Revisar `embarques_alertas_ids()` y el service `services/cierre.ts` para aplicar el
  mismo criterio en el conteo de CxC pendiente.
- No se tocan datos: no se inventan pagos ni se modifican las 31 facturas legacy.
- Bump de `APP_VERSION` + entrada en `CHANGELOG.md`.

## Alternativa (no incluida)

Registrar pagos "de regularización" para las 31 facturas legacy dejaría el libro de caja
completo, pero mete movimientos bancarios inexistentes y ensucia conciliación y flujo de
caja. Se descarta salvo que lo pidas.
