# Pulido de experiencia: aplicar un cobro a varias facturas

El flujo ya existe y funciona (reparto FIFO, validaciones, actualización de saldo y estatus). Este plan sólo mejora la experiencia del modal "Cobro en lote de cliente" para que el usuario entienda de un golpe de vista qué está pasando y corrija más rápido.

## Mejoras propuestas

1. **Saldo restante en vivo, más visible**
   La banda inferior mostrará tres cifras claras: importe recibido, repartido y sin asignar, con color de aviso cuando falte o sobre dinero, y el mensaje de error justo debajo.

2. **Atajos de reparto**
   Botones sobre la tabla:
   - "Repartir FIFO" (recalcula desde el importe recibido, lo que vence antes primero).
   - "Liquidar todo" (asigna el saldo completo de cada factura).
   - "Limpiar reparto" (deja todo en cero).
   - Por renglón, un botón "Saldo" que asigna el saldo completo de esa factura sin exceder lo que queda sin asignar.

3. **Ayudas visuales por renglón**
   - Resaltar el renglón cuando el importe excede el saldo de la factura (borde de error) en vez de sólo un mensaje general.
   - Chip de vencimiento: "Vence en X días" o "Vencida X días", para justificar el orden FIFO.
   - Marcar con un icono las facturas que exigen complemento de pago (REP), hoy sólo se cuentan en la banda inferior.

4. **Sin asignar más entendible**
   Cuando queda sobrante, el aviso dirá el importe exacto que falta repartir y ofrecerá el botón para asignarlo automáticamente a la siguiente factura pendiente.

5. **Accesibilidad y foco**
   - Al abrir, el foco va al importe recibido.
   - Los importes por factura se recorren con Tab en orden de vencimiento.

No se cambian reglas de negocio: cuadre exacto, prohibición de factura duplicada, tope por saldo, moneda de la cuenta y actualización de estatus siguen igual.

## Detalles técnicos

- `DialogCobroLoteRenglones.tsx`: botón "Saldo" por renglón, estado de error por renglón, chip de días de vencimiento e indicador REP. Se extrae una fila a un subcomponente (`CobroLoteRenglon.tsx`) para mantener el límite de 200 líneas.
- `DialogCobroLoteResumen.tsx`: agregar el importe recibido y el CTA "Asignar sobrante".
- Nuevo `DialogCobroLoteAcciones.tsx` con los atajos de reparto.
- `usePagoClienteLoteState.ts`: exponer `liquidarTodo`, `limpiarReparto`, `asignarSobrante`, `asignarSaldoFactura(id)` y un mapa de errores por renglón derivado de las validaciones existentes.
- Lógica pura nueva en `pagoClienteLote.ts` / `cobroLoteValidaciones.ts` (`repartirTodo`, `erroresPorRenglon`) con tests unitarios en `__tests__/pagoClienteLote.test.ts`.
- Tokens del design system para colores (`text-warning`, `border-destructive`), sin colores fijos.
- Actualizar `CHANGELOG.md` y subir `APP_VERSION`.
