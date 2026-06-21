## Plan: Mejoras móviles P1 + P2 (sin bottom tab bar)

Continúo con el resto de la auditoría móvil, omitiendo el `MobileTabBar`.

### P1 — Usabilidad fuerte

1. **Tap targets 44×44 mínimo** en íconos del header (`Layout.tsx`): `ThemeToggle`, `NotificacionesPopover`, `FeedbackButton`, botón de búsqueda — `h-11 w-11` en `<sm`, mantener `h-9 w-9` en `≥sm`.
2. **FAB de Clientes** (`Clientes.tsx`): añadir `aria-label="Nuevo cliente"`, `pb-[env(safe-area-inset-bottom)]`, asegurar que no tape la última fila (margen inferior en la lista en `<sm`).
3. **`HuecoFacturacionCard.tsx`**: layout vertical en `<sm` — apilar título / métricas (USD y MXN en dos líneas con `tabular-nums`) / botón "Ver detalle" full-width.
4. **Toolbar de Facturas Emitidas** (`TabFacturasEmitidas.tsx`): agrupar "Exportar CSV" + "Layout contable" en un único `DropdownMenu` "Exportar ▾" en `<sm`; el `Select` de estado a `w-full sm:w-[180px]`.
5. **`Reportes.tsx`**: en `<sm` colapsar "PDF" + "Exportar CSV" en un `DropdownMenu` "Exportar ▾" con ícono `Download`.
6. **Sidebar overflow** (`AppSidebar.tsx` / `SidebarUserMenu.tsx`): aplicar `truncate min-w-0` al email y nombre, `text-[11px]` consistente, evitar que el rol/email desborden a la derecha.

### P2 — Pulido

7. **`SidebarGroupBlock` labels**: subir contraste y aumentar a `text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/70`.
8. **Estilo ghost consistente** en íconos del header (mismo `variant="ghost" size="icon"` y radio).
9. **`ReportesTablaClientes` mobile card**: agregar separador visual y aumentar a `text-xs` para mejor legibilidad (hoy `text-[11px]`).
10. **Aging chart (Inicio)**: en `<sm` convertir a barras horizontales compactas con tooltip; etiquetas no se truncan.

### Mantenimiento

- Bump `APP_VERSION` → `13.97.0`.
- Entrada en `CHANGELOG.md` describiendo P1+P2 móvil.
- Verificación visual con Playwright (390×844) de Inicio, Clientes, Facturación, Reportes y sidebar abierto.

### Archivos a tocar

`src/components/layout/Layout.tsx`, `src/components/layout/AppSidebar.tsx`, `src/components/layout/SidebarUserMenu.tsx`, `src/components/layout/SidebarGroupBlock.tsx`, `src/features/cliente/routes/Clientes.tsx`, `src/features/facturacion/components/HuecoFacturacionCard.tsx`, `src/features/facturacion/components/TabFacturasEmitidas.tsx`, `src/features/reportes/routes/Reportes.tsx`, `src/features/reportes/components/ReportesTablaClientes.tsx`, posible nuevo aging chart móvil en `src/features/dashboard/...`, `src/constants/appVersion.ts`, `CHANGELOG.md`.
