# Plan: Pulir Portal de Cliente (UI/UX, foco mobile)

Auditoría completada (subagente revisó las 7 rutas: `/portal`, `/embarques`, `/embarques/:id`, `/cotizaciones`, `/cotizaciones/:id`, `/facturas`, `/perfil`). Confirmado que ~78% de los problemas son mobile-only. Propongo 3 fases incrementales, cada una termina en un release con bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

---

## Fase 1 — Quick Wins (1 commit, ~1h)

Cambios pequeños, alto ROI, sin refactor:

1. **Notificaciones overflow mobile** — `PortalNotificationsBell.tsx`: `w-80` → `w-[min(320px,calc(100vw-24px))]`.
2. **Facturas card sin acción** — quitar `hover:shadow-sm` engañoso en `PortalFacturas.tsx` (o añadir cursor + tooltip "Sin detalle").
3. **Tooltips en puertos truncados** — añadir `title` en Origen/Destino de `PortalEmbarqueDetalle.tsx`.
4. **Perfil padding doble** — eliminar `px-3 sm:px-6` redundante en `PortalPerfil.tsx`.
5. **Collapsible expedientes** — `defaultOpen={false}` en mobile para `PortalEmbarques.tsx` (con `useIsMobile`).
6. **Documentos overflow temporal** — envolver `DataTable` con `overflow-x-auto -mx-4 px-4` hasta refactor cards.
7. **Dashboard layout shift** — `PortalEstadoEmbarquesCard` y `PortalFacturacionPendienteCard`: reemplazar `return null` con empty state inline; fijar colspan de `PortalEmbarquesRecientesCard`.

**Versión:** 12.20.0

---

## Fase 2 — Críticos Mobile (2-3 commits)

### F2.1 — Bottom Navigation Bar (mobile)
Nuevo `src/components/portal/layout/PortalBottomNav.tsx`:
- 4 íconos+label: Inicio · Embarques · Cotizaciones · Facturas
- `fixed bottom-0`, `z-50`, `md:hidden`, `pb-[env(safe-area-inset-bottom)]`
- Activo: `bg-accent/10 text-accent` (igual patrón que header)
- Integrar en `PortalLayout.tsx`; añadir `pb-16 md:pb-0` al `<main>` para no tapar contenido
- Hamburger queda solo para Perfil + Cerrar sesión + Tema
- Añadir `/portal/perfil` al drawer (bug B1)

### F2.2 — Header de Cotización mobile (C1)
`PortalCotizacionHeader.tsx`: en mobile, mover botones "Rechazar"/"Aceptar" a una **action bar sticky bottom** (`fixed bottom-16` por encima del bottom-nav) con `md:hidden`. En desktop mantener layout actual.

### F2.3 — Documentos como cards en mobile (C2)
`PortalEmbarqueDocumentos.tsx`: extraer `PortalDocumentoCard.tsx`. En `<md` render lista de cards (nombre, badge estado, botón descarga full-width). En `md+` mantener `DataTable`.

### F2.4 — Stepper vertical en mobile (C3)
`PortalEmbarqueDetalle.tsx` líneas 71-116: extraer a `PortalEmbarqueStepper.tsx`. En `<sm` render vertical (línea izquierda, label completo, paso actual destacado). En `sm+` mantener horizontal.

**Versión:** 12.21.0

---

## Fase 3 — Cards y filtros responsive (1-2 commits)

### F3.1 — `EmbarqueCard` rediseño mobile (A1)
Eliminar `pl-[52px]` hardcoded. En `<sm`:
- Row 1: ícono modo + expediente + badge estado
- Row 2: ruta con `MapPin`, sin indent
- Row 3: ETD/ETA como dos pills + carrier (truncado si no cabe)

### F3.2 — Filtros mobile en lista (M3)
`PortalEmbarques.tsx`: reutilizar patrón `CotizacionesMobileFilters` (ya existe en `src/components/cotizacion/`) — search input visible + botón "Filtros (n)" que abre `Sheet` con selects.

### F3.3 — KPI grid horizontal mobile (M1)
`PortalKpiGrid.tsx`: en mobile `grid-cols-3` compacto (número + label corto) en lugar de stack vertical.

**Versión:** 12.22.0

---

## Fuera de alcance (propuestas futuras, no en este plan)

- **Página de detalle de factura** (E4): nueva ruta, hook, RLS check — requiere decisión de producto (¿hay PDF en `archivo`? ¿qué muestra?).
- **`TablaConceptosGenerico` responsive** (E5): afecta también vista admin — refactor cross-cutting.
- **Refactor del header desktop en `md` breakpoint** (M6): bajo impacto, esperar feedback.

---

## Detalles técnicos

- **Sin cambios de backend, RLS, schema, hooks de datos.** Solo capa de presentación.
- **Cumple Power of 10**: cada componente nuevo ≤200 líneas; extracciones (`PortalDocumentoCard`, `PortalEmbarqueStepper`, `PortalBottomNav`) mantienen archivos padres bajo el límite.
- **Sin `style={{}}`** salvo `paddingBottom: env(safe-area-inset-bottom)` (excepción dinámica permitida).
- **Tokens semánticos**: usar `bg-accent`, `text-accent`, `bg-muted`, `border-border` — no colores hardcoded.
- **Reutilización**: `useIsMobile` de `@/hooks/shared`, patrón `Sheet` de filtros ya existente en cotizaciones, `BrandLockup` ya en uso.
- **Changelog**: una entrada por fase con bullets visibles para el usuario final (en español MX).
- **Verificación por fase**: `npm test` (suite actual 781), screenshots manuales en `390x844` y `1366x768`.

¿Procedo con Fase 1 primero, o quieres reordenar prioridades (p.ej. ir directo al bottom nav)?
