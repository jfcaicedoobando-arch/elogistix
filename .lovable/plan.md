# Modal "Pago en lote a proveedor" con el diseño del cobro en lote

El modal de Cuentas por Pagar se rediseña para quedar idéntico en estructura y UX al de Cuentas por Cobrar ("Cobro en lote de cliente"), que ya fue auditado visualmente.

## Qué cambia para el usuario

1. **Modal más ancho** (igual que el de cobro), con el **saldo seleccionado siempre visible** en la esquina superior derecha del encabezado.
2. **Datos de la transferencia en 3 columnas** (fecha, importe, método, cuenta bancaria, referencia), con textos de ayuda cortos debajo de cada campo en lugar de líneas largas.
3. **Tabla de reparto mejorada**:
   - Filas alternadas (zebra) y anchos de columna fijos.
   - Campo de importe alineado a la derecha, más alto y con la moneda formateada.
   - Etiquetas **Liquidada** / **Parcial** junto al saldo restante de cada factura.
   - Scroll horizontal en pantallas angostas en vez de columnas apretadas.
4. **Banda fija de totales sobre los botones**, siempre visible aunque se haga scroll: repartido, sin asignar (en ámbar si sobra dinero), cuántas facturas quedan liquidadas y el mensaje de error de validación.
5. **Notas** en su propia sección con etiqueta y placeholder.

No cambia ninguna regla de negocio: mismo reparto FIFO, mismas validaciones, misma RPC y mismo movimiento bancario único.

## Detalles técnicos

- `DialogPagoLoteProveedor.tsx`: `size="3xl"`, `bodyClassName="py-4 space-y-4"`, `headerAside` con saldo seleccionado, `stickyBottom` con el nuevo resumen; se elimina el bloque de totales que hoy vive dentro de la sección de reparto y se pasan las secciones a `flat`.
- Nuevo `src/features/cxp/components/DialogPagoLoteResumen.tsx`, espejo de `DialogCobroLoteResumen` (sin la parte de REP, que es exclusiva de CxC): repartido, sin asignar, conteo de liquidadas y `error`.
- `DialogPagoLoteDatos.tsx`: grid `sm:grid-cols-2 md:grid-cols-3`, `gap-x-4 gap-y-3`, hints cortos ("Catálogo interno", "Opcional"/"Requerida", `TC DOF`), `aria-label` en los `SelectTrigger`.
- `DialogPagoLoteRenglones.tsx`: `overflow-x-auto`, `min-w-[620px]`, anchos porcentuales, zebra con `cn(... i % 2 === 1 && "bg-muted/20")`, `MoneyInput` con `currency` y `value={monto === 0 ? null : monto}`, badges `Liquidada`/`Parcial`.
- Sin cambios en `usePagoLoteState`, `pagoProveedorLote.ts` ni en la RPC.
- Tests: se ajustan/añaden pruebas del diálogo CxP (render del resumen sticky, badges de liquidada/parcial, error visible).
- Cierre: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
