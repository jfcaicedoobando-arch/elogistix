## Objetivo

Mejorar el modal **Detalle de pagos** (CXP) siguiendo la dirección "Densa + tooltips", aclarando las columnas técnicas TC y Δ MXN sin agregar funcionalidad nueva.

## Aclaración de términos (mostrados como tooltips)

- **TC Pago** — Tipo de Cambio USD→MXN registrado al momento de aplicar el pago.
- **Dif. Cambio** — Diferencia cambiaria en MXN entre la tasa de la factura y la del pago (ganancia/pérdida cambiaria).

## Cambios

Archivo único: `src/components/cxp/DialogDetallePagosProveedor.tsx`.

### Header
- Subtítulo `folio — proveedor` en estilo monoespaciado, mayúsculas, tracking amplio.

### KPIs
- Grid de 4 columnas con tarjetas `bg-muted/30 border` y padding mayor.
- Labels en `text-[10px] uppercase font-bold tracking-tight text-muted-foreground`.
- Etiquetas más explícitas: **Total Factura**, **Total Pagado**, **Saldo Pendiente**, **# Pagos**.
- Tonos semánticos: Pagado en `text-success`; Saldo en `text-warning` si > 0, gris si 0.

### Tabla
- Renombrar columnas:
  - `TC` → **TC Pago** + ícono `Info` con `Tooltip` ("Tipo de cambio USD→MXN al momento del pago").
  - `Δ MXN` → **Dif. Cambio** + ícono `Info` con `Tooltip` ("Diferencia cambiaria (ganancia/pérdida) en MXN entre la tasa de la factura y la del pago").
- Combinar Método + Referencia en una sola columna apilada (método en negrita arriba, `Ref: XXXX` chico abajo). Eliminar la columna Referencia separada.
- Header de tabla con fondo `bg-muted/40`, separador `divide-y`.
- Hover de fila `hover:bg-muted/30`.
- Mantener tabular-nums y formato actual de fechas/montos.
- Botón eliminar: ícono más pequeño con hover destructive (`hover:bg-destructive/10 hover:text-destructive`).

### Footer
- Sin cambios funcionales (botón Cerrar).

## Tokens y reglas

- Usar tokens semánticos (`bg-muted`, `text-muted-foreground`, `text-success`, `text-warning`, `text-destructive`, `border`) — NO clases zinc/slate del prototipo.
- Tooltip vía `@/components/ui/tooltip` (Radix) envuelto en `TooltipProvider` local.
- Componente debe seguir <200 líneas y respetar Power of 10.

## Lo que NO cambia

- Lógica de datos (`usePagosProveedor`, `useEliminarPagoProveedor`).
- Tamaño del modal (`dialogSize["3xl"]`).
- Flujo de doble confirmación de eliminación.
- Permiso `canEdit`.

## Versionado

- `APP_VERSION` → `12.81.4`.
- Entrada en `CHANGELOG.md`: "Mejora visual del modal Detalle de pagos en CXP: KPIs con tonos semánticos, tooltips explicativos en columnas TC Pago / Dif. Cambio, y agrupado de Método+Referencia."

## Verificación

1. Abrir CXP → clic en una factura con pagos → confirmar KPIs, tooltips al hover en TC Pago / Dif. Cambio, y columna combinada Método/Referencia.
2. Probar eliminación de pago (doble confirmación) sigue funcionando.
3. Validar contraste correcto en tema oscuro.
