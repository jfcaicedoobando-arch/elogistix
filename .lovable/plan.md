# Plan: Cohesión visual exhaustiva del UI Kit

**Alcance**: Exhaustivo — todos los hallazgos del audit + refactor de hot spots a componentes canónicos (`PageHeader`, `FormDialogShell`, `Button`, `Card` sin overrides). Sin tocar lógica de negocio.

**Patrones canónicos (referencia)**:
- Modales con formulario → `<FormDialogShell>` + `dialogSize.*`
- AlertDialog → solo confirmaciones (nunca forms)
- Cards → `<Card>` sin override de `shadow-*`, `border-*`, `rounded-*`; `shadow-card` ya viene en el token
- Botones → `<Button variant size>` (sin `<button>` crudo); icon-only requiere `aria-label`
- Colores → tokens semánticos (`text-primary-foreground`, `text-muted-foreground`, `bg-warning/10`, etc.), nunca `text-white`, `text-gray-*`, `bg-amber-*`
- Tipografía → `<PageHeader>` para títulos de página; `text-kpi` para KPIs vía `<KpiStrip>`
- Toasts → `useToast` (shim canónico) en features

---

## Lote 1 — Modales (Alta prioridad)

Migrar a `<FormDialogShell>` (mantiene props existentes, sólo cambia shell):
1. `DialogCancelarFactura.tsx` (F-01)
2. `PanelConciliacionMovimiento.tsx` motivo dialog (F-02)
3. `DialogMarcarFacturada.tsx` (F-04)
4. `FilaContenedor.tsx` (F-03): convertir `AlertDialog` → `Dialog` + `FormDialogShell` (era un form disfrazado de confirmación)

---

## Lote 2 — Cards (overrides de shadow/border/rounded)

Quitar `shadow-sm border-0 rounded-2xl` y dejar `<Card>` limpio:
1. `operaciones/routes/Operaciones.tsx` (F-05)
2. `operaciones/components/KpiCard.tsx` (F-06)
3. `reportes/components/ReportesTopChart.tsx` + `ReportesTablaClientes.tsx` (F-07)
4. `auth/routes/Login.tsx` + `ResetPassword.tsx`: `shadow-lg` → `shadow-raised` (F-08)
5. `costeo/components/TarifaResultCard.tsx`: estado seleccionado usa `shadow-raised` + `ring-success/40` en lugar de `shadow-md border-2` (F-09)

**Decisión sobre Q1 (rounded-2xl en tiles)**: usar `rounded-lg` (token estándar). No introducir variante `tile`.

---

## Lote 3 — Colores hardcoded

1. `Operaciones.tsx` líneas 106–107: `text-white` → `text-primary-foreground` (F-10)
2. `MiOperacionWidgets.tsx`: `text-white text-[11px]` → `text-primary-foreground text-xs` (F-11)
3. `ResumenConceptosVenta.tsx`: badge `bg-white/20 text-white` → `variant="outline"` con tokens (F-12)
4. `ResumenConceptosVentaTotales.tsx`: `text-gray-600` → `text-muted-foreground` (F-13)
5. `TabCategorias.tsx`: `bg-amber-100/text-amber-900` → `bg-warning/10 text-warning-foreground`; `bg-slate-100` → `bg-muted text-muted-foreground` (F-14)

---

## Lote 4 — Tipografía (PageHeader)

Reemplazar `<h1 className="text-2xl font-bold">` por `<PageHeader>`:
1. `proveedor/routes/ProveedorDetalle.tsx` (F-15)
2. `cliente/components/detalle/ClienteDetalleHeader.tsx` (F-16)
3. `portal/routes/PortalPerfil.tsx` (F-18)
4. `crm/routes/Analitica.tsx` + `CrmDashboard.tsx`: KPIs sueltos → reusar `<KpiStrip>` (F-17)

---

## Lote 5 — Botones y a11y

1. `LoginForm.tsx`: `<button>` crudo → `<Button variant="link" size="sm">` (F-19)
2. Agregar `aria-label` a todos los `<Button size="icon">` listados en F-20:
   - `facturacionColumns.tsx`, `ThemeToggle.tsx`, `NotificacionesPopover.tsx`, `TabProyeccion.tsx`, `HallazgosTabla.tsx`, `ContactActions.tsx`, `ProveedorDatosBancariosCard.tsx`

---

## Lote 6 — Paddings de Tesorería + decisión sobre toasts

1. **Tesorería/Comisiones**: extraer wrapper `<DenseCard>` (o variante `density="dense"` en `Card`) que aplique `CardContent` con `p-3/p-4` legítimamente, y migrar `Tesoreria.tsx`, `TesoreriaFlujo.tsx`, `TesoreriaConciliacion.tsx`, `Comisiones.tsx`.
2. **Q3 (toasts)**: consolidar guidance en `useToast` (shim). Actualizar JSDoc del shim para deprecar el "prefer sonner directo". No requiere migrar archivos (no hay imports directos de sonner en features hoy).
3. `p-0` en CardContent con tablas full-bleed: documentar en `Card` JSDoc como patrón aprobado (Q2).

---

## Verificación

Por lote:
- `bun run lint -- --max-warnings 0`
- `bun run test` (asegura que tests existentes pasen)
- Screenshots Playwright 1920×1080 de: `/embarques`, `/facturacion`, `/operaciones`, `/reportes`, `/tesoreria`, `/clientes/{id}`, `/proveedores/{id}`, `/login`

Al cierre:
- Bump `APP_VERSION` (minor, p.ej. `13.140.0`) — cambio amplio de UI kit
- Entrada en `CHANGELOG.md` listando los 6 lotes
- Actualizar `mem://style/form-dialog-shell` y crear `mem://style/card-tokens` si formalizamos `DenseCard`

---

## Resumen para programador principiante

Imagínate que la app es un edificio donde algunas habitaciones se construyeron con ladrillos distintos al resto. Este plan reemplaza esos ladrillos sueltos con los oficiales del sistema, sin mover paredes ni cambiar muebles (la lógica). Al final, todas las habitaciones se sienten parte del mismo edificio.

**Riesgos**: bajos — son cambios visuales y de wrappers. El único riesgo medio es F-03 (AlertDialog→Dialog) por cambio de focus trap; se valida manualmente.
