# Marcar 5 facturas legacy como pagadas

Corrección puntual de datos: estas 5 facturas del sistema anterior ya fueron cobradas fuera de la app y hoy aparecen como "Vencida".

## Facturas afectadas (todas de Sergio Iñiguez, USD)

| Folio | Expediente | Total | Vencimiento | Estado actual |
|-------|-----------|-------|-------------|---------------|
| 658 | ELIMP00076 | 55,646.10 | 20/01/2026 | Vencida |
| 659 | ELIMP00078 | 3,569.00 | 20/01/2026 | Vencida |
| 768 | ELIMP00107 | 2,415.68 | 04/03/2026 | Vencida |
| 785 | ELIMP00100 | 1,476.40 | 11/03/2026 | Vencida |
| 788 | ELIMP00101 | 11,315.60 | 12/03/2026 | Vencida |

Verificado en la base: ninguna tiene pagos registrados y todas pertenecen a la misma organización.

## Qué se hará

- Cambiar únicamente el estado de esas 5 facturas a **Pagada**.
- No se crean registros de pago (así lo decidiste), por lo que no impactan flujo de caja ni conciliación bancaria.
- Se deja una nota en cada factura indicando que fue cobrada en el sistema anterior (migración legacy), para que quede rastro de por qué no hay pago asociado.
- No se toca ningún otro dato: montos, moneda, fechas y cliente quedan intactos.
- No se agrega ningún botón nuevo en la app (limpieza única).

## Resultado esperado

En Cobranza / Cartera dejan de contar como vencidas y su saldo pendiente sale de la antigüedad (aging).

## Detalles técnicos

- Actualización de datos (no migración de esquema) sobre `public.facturas` filtrando por los 5 `id` exactos ya identificados.
- `estado` pasa a `'Pagada'`; se concatena nota `[Legacy] Cobrada en sistema anterior; pago no registrado en la app.` en `notas`.
- El trigger `bloquear_modificacion_factura_emitida` permite este cambio porque no se altera número, montos, moneda, tipo de cambio, fechas ni relaciones.
- `congelar_factura_al_emitir` generará el snapshot de emisión si aún no existe; es el comportamiento normal al pasar a Pagada.
- Se registra la corrección en `CHANGELOG.md` con bump de `APP_VERSION`.
