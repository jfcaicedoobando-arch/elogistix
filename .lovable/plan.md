# Rediseño modal "Nueva factura manual"

Reorganizar el modal en 4 secciones-tarjeta apiladas + un panel de resumen en navy junto a las notas. Sin cambios de lógica, sólo composición visual.

## Analogía

Hoy el modal es una hoja apretada con 12 casillas en una sola cuadrícula. Después será una **carpeta con 4 pestañas apiladas**: Cliente, Datos fiscales, Conceptos, Notas + Total. Cada bloque respira y el Total queda como una **placa navy** que llama la atención, aunque siga marcando $0.00.

## Alcance

Sólo cambios de UI (Tailwind / composición) en 3 archivos. Ningún cambio en:
- Hook `useFacturaManualForm.ts` (contrato inalterado).
- Servicios, RPC, validaciones, timbrado, alerta de crédito.
- Campos del formulario (mismos 8 fiscales + tabla + notas + 3 botones).

## Cambios

### 1. `DialogNuevaFacturaManual.tsx`
- Envolver cada zona en `<section className="rounded-lg border bg-card p-5 space-y-4">` con `<h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">`.
- 4 secciones: **Información del Cliente**, **Datos fiscales**, **Conceptos**, y bloque de dos columnas **Notas / Resumen**.
- Fondo del área scrollable en `bg-muted/30` para que las tarjetas resalten en `bg-card`.
- Alert de "cliente incompleto" se queda dentro de la tarjeta de cliente.
- Footer sin cambios estructurales (ya lo maneja `FormDialogShell`).

### 2. `FacturaManualDatosFiscales.tsx`
- Mantener grid 4 columnas actual, pero:
  - Labels a `text-xs font-medium text-muted-foreground`.
  - Inputs a `h-9` (más compactos y consistentes).
  - "Moneda" pasa a **chips seleccionables** (MXN · USD · EUR) usando `Badge`/botones tipo toggle — más rápido y comunica mejor la moneda activa.
  - Botón "Traer TC DOF" se queda al lado de Tipo de cambio (sin cambios funcionales).

### 3. `FacturaManualConceptosTable.tsx`
- Cabecera de tabla real (`<thead>` con `bg-muted text-muted-foreground uppercase text-[11px]`) en lugar del layout grid con labels por fila.
- Padding vertical a `py-2.5` para reducir densidad visual manteniendo compacto.
- Botón "Agregar concepto" pasa a link-style azul (`text-primary hover:underline`) alineado a la derecha del título.
- Bloque de totales queda **fuera** de la tabla, dentro del panel navy nuevo.

### 4. Nuevo panel de Total (dentro del dialog, no archivo separado)
Bloque `bg-[hsl(var(--primary))] text-primary-foreground rounded-lg p-6 shadow` con:
- Subtotal (texto muted-claro).
- IVA (texto muted-claro).
- Divisor.
- **Total** con `text-2xl font-bold` + código de moneda pequeño al lado.

Se coloca en `grid md:grid-cols-2 gap-6` junto al textarea de Notas.

## Detalles técnicos

- Se usan tokens semánticos (`bg-card`, `border`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`) — nada hardcodeado en hex. La paleta locked ya define `--primary: #1B2B4B`.
- El totales panel deriva `subtotalR`, `ivaR`, `total` del cálculo actual en `FacturaManualConceptosTable`. Para exponerlos al dialog sin duplicar lógica: extraer una función pura `calcularTotalesConceptos(conceptos, tasaIva)` en un archivo utilitario nuevo (`src/features/facturacion/utils/totalesConceptos.ts`, ~20 LOC) y consumirla desde ambos lugares.
- `FormDialogShell size="xl"` se mantiene; se conservan `<FormDialogSection>` si aplica según convención — de lo contrario, secciones locales con `<section>` (mem `form-dialog-shell` permite ambos cuando el shell ya está en uso).
- Todos los archivos siguen ≤200 LOC (Power of 10).

## Verificación

- `bun run typecheck`
- `bun run lint -- --max-warnings 0`
- Playwright FullHD (1920×1080) screenshot del modal antes/después.
- Test unitario nuevo para `calcularTotalesConceptos` (3 casos: MXN 16%, tasa 0%, exento).
- Manual: abrir modal, elegir cliente sin RFC → alert; añadir 2 conceptos con IVA distinto → total navy actualiza; cambiar moneda con chips → TC habilita botón DOF.

## Changelog

Bump `APP_VERSION` a `13.315.1` y añadir entrada:

```
### UI
- Rediseño del modal "Nueva factura manual": secciones en tarjetas, resumen del total en panel navy y chips de moneda.
```
