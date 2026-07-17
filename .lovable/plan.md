## Objetivo

Bloquear por completo la creación de notas de crédito cuando la factura ya está liquidada (saldo ≈ 0). Aplicar defensa en 3 capas: UI, dialog y base de datos.

## Cambios

### 1. UI — `FacturaNotasCreditoSeccion.tsx`
- Calcular `facturaLiquidada = saldoFactura <= 0.01`.
- Si está liquidada: ocultar el botón "Nueva" (o mantenerlo `disabled` con `Tooltip` explicativo: *"La factura ya está liquidada. No se pueden emitir notas de crédito sobre facturas sin saldo pendiente."*). Preferencia: **disabled + tooltip** para que el usuario entienda la razón, no que "desaparezca".
- Bloquear también apertura del dialog (aunque el botón esté deshabilitado, defensa extra en `onClick`).

### 2. Dialog — `DialogCrearNotaCredito.tsx`
- Añadir guard: si `saldoFactura <= 0.01` mostrar mensaje bloqueante y deshabilitar `Guardar` / `Timbrar` (además del check ya existente `excedeSaldo`).

### 3. Base de datos — nuevo trigger BEFORE INSERT sobre `factura_notas_credito`
- Valida que la factura padre tenga `saldo > 0.01`.
- Si no, `RAISE EXCEPTION` con mensaje claro para que la UI lo capture.
- Blindaje contra cualquier ruta (RPC, scripts, integración futura).

### 4. Documentación
- `CHANGELOG.md`: entrada nueva versión.
- `APP_VERSION` → siguiente patch (`13.301.40`).

## Fuera de alcance
- No se toca el módulo de auditoría, ni el flujo de cancelación de NC existentes.
- No se cambia la lógica para facturas parcialmente pagadas (saldo > 0): siguen permitiendo NC.

## Detalles técnicos

- Trigger SQL (pseudo):

```text
CREATE FUNCTION check_saldo_factura_para_nc() ...
  IF saldo <= 0.01 THEN RAISE EXCEPTION 'FACTURA_LIQUIDADA_SIN_NC'
```

- Umbral `0.01` consistente con `puedeRegistrarPago` en `facturaFlags.ts`.
- Manejo de error en el hook `useCrearNotaCredito` para traducir el código a mensaje amigable.

## Analogía
Es como el cajero automático: si tu cuenta ya está en cero, la máquina simplemente no te deja iniciar un retiro — no aparece el botón habilitado, y aunque intentaras forzarlo, el banco (la base de datos) lo rechaza.
