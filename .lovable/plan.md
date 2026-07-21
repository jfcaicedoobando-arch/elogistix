## Objetivo

Aplicar la dirección **v2 "Card grid estructurada"** al modal `DialogDetallePagosProveedor` sin cambiar datos, RPCs ni comportamiento. Todo es refactor visual y de jerarquía usando tokens semánticos del sistema (`--primary`, `--accent`, `--muted`, etc.), sin hex hardcoded en componentes.

## Cambios por archivo

### 1. `DialogDetallePagosProveedor.tsx`
- Header: `DialogTitle` en fila con un chip de folio interno (`FP-000037`) monospace pequeño al lado del título. El resto del descriptor (Folio prov. + proveedor) baja a una segunda línea muted.
- Reemplazar la fila de descripción actual por: título + folio-chip a la izquierda; a la derecha nada (las acciones bajan a la nueva "action bar").
- Quitar el `border-b` extra entre bloques que crea líneas duplicadas.

### 2. `DialogDetallePagosProveedor.sections.tsx` → `FacturaToolbar`
- Convertirse en una **Status & Primary Action Bar**: fondo `bg-accent/5`, `border-b border-accent/10`.
- Izquierda: dot + label del estado de aprobación ("Pendiente", "Aprobada", "Rechazada", "Cancelada") con color por tono (warning/success/destructive/muted) — reemplaza al chip suelto que hoy vive dentro de `BotonesAprobacionFactura`.
- Derecha: acción **primaria contextual** según flags:
  - `pendiente` → `Aprobar` (primary) + `Rechazar` (soft destructive outline).
  - `aprobada` con saldo > 0 → `Registrar pago` (primary).
  - `aprobada` sin saldo o `pagada` → botón oculto, sólo estado.
- Acciones secundarias (`Editar`, `Cerrar sin pago`) van a un menú `⋯` overflow al final de la barra.
- **Eliminar factura** y **Cancelar factura** dejan de ser botones destacados: van dentro del overflow menu con separador y estilo destructivo discreto. Se elimina la duplicación actual ("Cancelar factura" aparece hoy dos veces: en toolbar-área y dentro de `InfoFacturaSection`).

### 3. `FacturaResumen` → nueva grilla de KPIs
- Grid `grid-cols-2 md:grid-cols-4 gap-3`, cada Kpi con `border border-border rounded-lg p-4 bg-card`.
- Aplicar `ring-2 ring-accent/20` al KPI dominante según estado:
  - Saldo > 0 → resalta **Saldo pendiente**.
  - Saldo = 0 → resalta **Total pagado**.
- Ajustar `Kpi` (en `.parts.tsx`) para aceptar prop `emphasis?: boolean`.
- Quitar el bloque anterior "aprobación separado + KPIs" (la aprobación ya vive en la action bar).

### 4. `InfoFacturaSection.tsx`
- Título "Información de la factura" con `border-b` fino y sin el botón "Cancelar factura" a la derecha (esa acción migra al overflow del toolbar).
- Grid `grid-cols-3 gap-y-4 gap-x-8 text-sm` con labels `text-xs text-muted-foreground` y valores `font-semibold`.
- Mover **CFDI adjuntos** y **Programación de pago** a una fila `grid-cols-2 gap-6` DEBAJO del bloque de información, no dentro del mismo card.
- Notas: card con `bg-muted/30` y texto sm; sólo se muestra si existe (ya lo hace).
- `AdjuntoRow` compacto: badge XML/PDF (colores `bg-accent/10 text-accent` para XML, `bg-destructive/10 text-destructive` para PDF), nombre truncado, ícono de descarga a la derecha en hover.

### 5. `HistorialFacturaSection.tsx`
- Convertir la sección a un colapsable cerrado por default: header con ícono reloj + "Historial de movimientos" + chevron. Al abrir muestra timeline vertical existente.
- Reducir densidad (líneas más apretadas, timestamp mono `text-xs text-muted-foreground`).

### 6. Footer
- Mantener `Cerrar` a la derecha. Retirar cualquier acción destructiva del footer (ya no hay).

## Diseño visual (tokens)

- Fondos: header modal `bg-muted/30`, action bar `bg-accent/5`, KPIs `bg-card`, sección info `bg-background`, notas `bg-muted/30`.
- Bordes: `border-border` con `rounded-lg` en KPIs y adjuntos.
- Estado dots: `bg-warning` (pendiente), `bg-success` (aprobada), `bg-destructive` (rechazada/cancelada), `bg-muted-foreground` (borrador).
- Tipografía: título `text-lg font-bold text-primary`, section headings `text-xs font-bold uppercase tracking-wide text-primary`, labels `text-xs text-muted-foreground`, valores `text-sm font-semibold text-foreground`, montos con `tabular-nums`.
- Sin hex crudos en el TSX; todo vía tokens Tailwind ya definidos.

## Verificación

1. `bunx vitest run src/lib/__tests__/architecture-baseline.test.ts` — asegurar que los archivos siguen ≤ 200 líneas.
2. Playwright headless a 1920×1080 abriendo dos facturas (una `pendiente` y una `aprobada con saldo`), screenshot y comparar contra el prototipo v2.
3. `bun run lint -- --max-warnings 0`.

## Notas técnicas

- No se toca `useFacturaProveedor`, `usePagosProveedor`, `usePermissions`, ni ninguna RPC.
- El chip de estado de aprobación se extrae de `BotonesAprobacionFactura` a un helper `EstadoAprobacionDot` reusable (nuevo archivo `EstadoAprobacionDot.tsx` ~40 líneas) para que `BotonesAprobacionFactura` siga siendo la única entrada a `aprobar_factura_proveedor` RPC.
- El overflow `⋯` usa `DropdownMenu` de shadcn ya existente.
- Bump `APP_VERSION` a `13.303.94` y entrada en `CHANGELOG.md`.

## Archivos tocados

- `src/features/cxp/components/DialogDetallePagosProveedor.tsx`
- `src/features/cxp/components/DialogDetallePagosProveedor.sections.tsx`
- `src/features/cxp/components/DialogDetallePagosProveedor.parts.tsx`
- `src/features/cxp/components/InfoFacturaSection.tsx`
- `src/features/cxp/components/InfoFacturaSection.parts.tsx`
- `src/features/cxp/components/HistorialFacturaSection.tsx`
- `src/features/cxp/components/BotonesAprobacionFactura.tsx` (extraer chip)
- Nuevo: `src/features/cxp/components/EstadoAprobacionDot.tsx`
- `src/lib/appVersion.ts` + `CHANGELOG.md`
