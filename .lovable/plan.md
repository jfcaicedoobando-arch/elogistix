## Objetivo

Implementar **modo inteligente** en `DialogTimbrarFactura`: cuando todos los preflight checks pasan y `uso_cfdi`/`forma_pago`/`metodo_pago` ya vienen definidos en la factura, mostrar una confirmación compacta de un solo click. Cuando falta información, mostrar el modal completo actual.

## Cambio de UX

**Fast-path (checks OK + campos definidos)** — ~80% de los casos:
```
┌───────────────────────────────────────────────────┐
│ 🟢 Timbrar factura BORRADOR-abc123               │
│                                                   │
│ Uso CFDI: G03 · Forma: 03 · Método: PUE          │
│ ☑ Enviar CFDI por email tras timbrar             │
│                                                   │
│ [ Editar datos fiscales ]  [ Cancelar ] [Timbrar]│
└───────────────────────────────────────────────────┘
```

**Full-path (algún check falla o falta campo)** — comportamiento actual sin cambios: checklist + 3 selects + checkbox + alerta.

El link "Editar datos fiscales" del fast-path expande al modal completo (mismo componente, distinto layout condicional).

## Cambios de código

1. **`src/features/facturacion/components/DialogTimbrarFactura.tsx`**
   - Añadir estado local `modoExpandido: boolean` inicial `false`.
   - Calcular `esFastPath = puedeTimbrar && Boolean(factura.uso_cfdi && factura.forma_pago && factura.metodo_pago)` (usar los valores del state que ya vienen inicializados desde la factura).
   - Si `esFastPath && !modoExpandido`, renderizar la vista compacta: 1 línea de resumen (`Uso CFDI: {usoCfdi} · Forma: {formaPago} · Método: {metodoPago}`), el checkbox de email y un botón secundario "Editar datos fiscales" que hace `setModoExpandido(true)`.
   - Si no, renderizar la vista actual (checklist + 3 selects + alerta).
   - Footer y `onConfirm` no cambian. `size="lg"` sólo en modo expandido; en fast-path usar `size="md"` para verse menos invasivo.

2. **Analogía interna en el JSX** (comentario): "Timbrar es como firmar contrato ante notario: si el borrador ya está limpio, sólo confirmas; si falta un dato, se abre el pliego completo."

3. **Tests** (`src/features/facturacion/components/__tests__/DialogTimbrarFactura.checks.test.ts` y agregar uno nuevo):
   - Caso fast-path: factura con `uso_cfdi='G03'`, `forma_pago='03'`, `metodo_pago='PUE'` y cliente con RFC/CP/régimen completos → el modal debe mostrar el resumen compacto, no los 3 selects.
   - Caso full-path: factura sin `uso_cfdi` → el modal debe mostrar los 3 selects.
   - Toggle "Editar datos fiscales" cambia a full-path aunque `esFastPath` sea true.

4. **`src/constants/appVersion.ts`** → `13.170.12`.

5. **`CHANGELOG.md`** → `[13.170.12] - 2026-07-04`: describe el modo inteligente, cita la práctica en Contpaq/Aspel/Odoo (paso preflight se mantiene, pero se compacta cuando no hay que decidir nada).

## Fuera de alcance

- No se toca el hook `useTimbrarFactura` ni la edge function.
- No se elimina el modal; sólo se compacta cuando no aporta información nueva.
- No se cambia `DialogTimbrarRep.tsx` (REP / complemento de pago) — ese sí requiere selección de facturas y no aplica fast-path.

## Verificación

- Preview: entrar a `/facturacion/{id}` de una factura borrador con datos completos, click "Timbrar" → debe abrir modal compacto de 1 línea. Cambiar los datos del cliente (borrar CP) → debe volver al modal completo.
- Correr `bunx vitest run DialogTimbrarFactura` — todos los tests verdes.
