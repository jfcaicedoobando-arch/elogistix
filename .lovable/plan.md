# Marcar facturas legacy como Pagadas

Corrección manual de datos. "Legacy" = facturas cuyo número no empieza con `F` (no se emitieron dentro del sistema).

## Qué encontré en la base

| Organización | Estado actual | Facturas | Importe |
|---|---|---|---|
| Elogistix | Vencida | 18 | 103,194.10 USD + 86,420 MXN |
| Elogistix | Pagada (ya correcta) | 107 | — |
| Demo Logistics MX (DLM-F00x) | Vencida | 7 | 56,098.40 USD |
| Demo Logistics MX (DLM-F008) | Borrador | 1 | 5,776.80 USD |

Ninguna de las vencidas tiene pagos registrados.

## Qué se hará

- Cambiar el estado a **Pagada** en las 25 facturas legacy que hoy no lo están (18 de Elogistix + 7 vencidas de la demo).
- La factura en Borrador (DLM-F008) se incluye en el mismo movimiento.
- **No** se crean registros de pago (así lo elegiste). Consecuencia: no habrá fecha de pago visible ni impacto en flujo de caja, conciliación bancaria ni REPs.
- Se agrega una nota en cada factura: `[Legacy] Cobrada en sistema anterior; pago no registrado en la app.` para que quede el rastro de por qué no hay pago asociado.
- No se toca ningún otro dato (montos, moneda, fechas, cliente, expediente).
- No se agrega ningún botón ni pantalla nueva: es una limpieza única.

## Resultado esperado

En Cobranza / Cartera / Aging estas facturas dejan de contar como vencidas y salen de la antigüedad. Las 107 legacy ya marcadas Pagada quedan igual.

## Detalles técnicos

- Actualización de datos (no migración de esquema) sobre `public.facturas`, filtrando `numero !~ '^F'`, `deleted_at IS NULL` y `estado IN ('Vencida','Borrador')`.
- `estado := 'Pagada'`; `notas` concatena la marca `[Legacy]` sin borrar el contenido previo.
- Sobre los guards: `bloquear_modificacion_factura_emitida` permite el cambio porque no se alteran número, montos, moneda, tipo de cambio, fechas ni relaciones. `guard_estado_factura` se valida en el momento de aplicar; si bloquea la transición directa Borrador→Pagada, esa única factura se atiende con el paso intermedio permitido (Emitida→Pagada) en la misma operación.
- `congelar_factura_al_emitir` generará el snapshot de emisión si falta; es el comportamiento normal al pasar a Pagada.
- Se registra la corrección en `CHANGELOG.md` con bump de `APP_VERSION`.
