## Estado actual

Fase 2 **no** cerró todos los list-items. Quedan cards/list-rows que se comportan como filas de tabla (una card por registro) y siguen envueltos en `<Link>`. El guardrail nuevo sólo bloquea `*columns.tsx`, así que estos archivos no se detectan automáticamente.

## Bloques pendientes (Fase 2.1)

### Bloque A — CRM dashboard
Cada archivo tiene una lista de N items donde cada item es una card clicable. Migrar a `useDrilldownRow`:

- `src/features/crm/components/crmDashboard/DealsCards.tsx` (líneas 42, 72) — oportunidades y leads.
- `src/features/crm/components/crmDashboard/ActividadesHoyCard.tsx` (42) — actividades.
- `src/features/crm/components/crmDashboard/NextBestActionsCard.tsx` (49) — acciones sugeridas.
- `src/features/crm/components/crmDashboard/CotizacionesSinRespuestaCard.tsx` (32) — cotizaciones.
- `src/features/crm/components/LineageCard.tsx` (33, 74, 91, 109) — cliente + leads + cotizaciones + embarques del linaje.

### Bloque B — Dashboard / Operaciones / Tesorería
- `src/features/dashboard/components/EmbarquesPendientesAdminCard.tsx` (61) — fila embarque.
- `src/features/dashboard/finance/components/PagosCajaBlock.tsx` (37 header-CTA se conserva, 84 list-row → migrar).
- `src/features/dashboard/finance/components/CobranzaBlock.tsx` (40 header-CTA se conserva, 91 list-row → migrar).
- `src/features/dashboardEjecutivo/components/AlertasPanel.tsx` (53) — fila alerta.
- `src/features/operaciones/components/embarquesEstadoDialog/EmbarqueEstadoListItem.tsx` (23) — item completo es link.

### Bloque C — Embarques cierre + Portal cliente
- `src/features/embarques/components/cierre/CierreCheckItem.tsx` (75) — item de checklist con `to`.
- `src/features/portal/components/dashboard/PortalFacturacionPendienteCard.tsx` (41) — fila factura pendiente.

### Bloque D — Admin / CxP
- `src/features/admin/routes/admin-org/PortalUsuariosTab.tsx` (53) — **`<Link>` inline dentro de celda `DataTable`** → migrar a `getRowHref` o quitar el link de la celda.
- `src/features/cxp/routes/_sections/ComprasDashboardTiles.tsx` (41) — cada tile del dashboard de compras es una card `<Link>` grande. Migrar a `useDrilldownRow` (opcional, revisar si es "botón de navegación" o "fila de datos").

### Bloque E — Guardrail extendido
Extender `src/__tests__/architecture/tables-no-inline-links.test.ts` (o crear uno nuevo) para escanear también:
- Archivos que rendericen `.map(...) <Link ...>` inmediatamente dentro de un `<CardContent>` o `<div className="space-y-...">` con más de 1 item por página.

Alternativa simple: agregar a la allowlist actual una convención — cualquier archivo que exporte un componente `*Card.tsx` / `*List*.tsx` que use `<Link>` dentro de un `.map()` debe usar `useDrilldownRow`. Esto es difícil de detectar con regex; **mejor camino:** documentar la regla en `mem://` y añadir revisión manual, sin ampliar el test automático (evita falsos positivos en headers/CTAs).

### Bloque F — Versionado
- Bump `APP_VERSION` a `13.203.0`.
- Entrada `CHANGELOG.md` listando archivos migrados.

## Fuera de alcance (confirmado como legítimo)

- Botones-link de header/toolbar de página, breadcrumbs, banners CTA, empty-state CTAs, acciones inline de detalle, marketing/legal, botones "Ver todos". Estos usan `<Button asChild><Link>` fuera de área de fila y son correctos.

## Orden de ejecución

1. Bloque A (CRM) — 5 archivos.
2. Bloque B (dashboards + operaciones) — 5 archivos.
3. Bloque C (cierre + portal) — 2 archivos.
4. Bloque D (admin + compras) — 2 archivos.
5. Bloque E — sólo memoria de convención (no test).
6. Bloque F — versión + changelog.

## Detalles técnicos

- Patrón por item: `const nav = useDrilldownRow({ href, ariaLabel })` → `<div {...nav} className={cn(nav.className, ...clases originales)}>...</div>`.
- Conservar controles internos (botones de acción, badges, dropdowns) — el helper ya los ignora vía `data-no-row-nav` / detección de elementos interactivos.
- No cambiar columnas visibles, layout, iconografía ni lógica.
- Verificar tras cada bloque: `bunx tsgo --noEmit` + tests afectados.
