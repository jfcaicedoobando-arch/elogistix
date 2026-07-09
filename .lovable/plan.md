## Tranche D · Auditoría de Portales (1920×1080)

Continuamos con la última tranche del plan original: los portales externos.

### Alcance

**Portal Cliente** (`PortalLayout`):
- `/portal` (dashboard)
- `/portal/embarques` + `/portal/embarques/:id`
- `/portal/cotizaciones` + `/portal/cotizaciones/:id`
- `/portal/facturas` + `/portal/facturas/:id`
- `/portal/perfil`

**Portal Agente** (`AgenteLayout`):
- `/agente` (dashboard)
- `/agente/tarifas`
- `/agente/garantias`
- `/agente/embarques`
- `/agente/perfil`

### Metodología (solo lectura)

1. **Capturas Playwright** a `viewport 1920×1080` con sesión inyectada, guardadas en `docs/ui-audit/screenshots/portal-*.png` y `docs/ui-audit/screenshots/agente-*.png`.
2. **Comparación contra baseline** (`00-baseline.md`) y contra los patrones ya normalizados en tranches A/B/C:
   - `PageContainer` + `PageHeader` (icon-tile `bg-accent/10`).
   - Densidad de tablas (`DataTable` estándar).
   - Breadcrumbs con `toTitleCase`.
   - KPIs bimoneda en dos líneas.
   - Tipografía H1/H2 canónica.
   - Placeholders `—` en celdas vacías.
   - Chevrons de orden unificados.
3. **Chequeos específicos de portales**:
   - Coherencia entre `PortalHeader` vs `AgenteLayout` header (ambos usan `BrandLockup` pero con estructura distinta).
   - Bottom nav móvil solo existe en cliente, no en agente → ¿es intencional?
   - Contenedor `max-w-screen-2xl` consistente entre ambos.
   - Footer version chip `v{APP_VERSION}` presente/coherente.
   - Estados vacíos con `EmptyState` canónico.

### Entregable

**`docs/ui-audit/06-capa3-tranche-d.md`** con:
- Screenshots referenciadas por ruta.
- Hallazgos numerados con severidad (🔴 HIGH / 🟠 MED / 🟡 LOW).
- Snippet corregido por hallazgo.
- Propuesta de **Lote 6** agrupado por bloques (6a, 6b, …) para aplicar tras aprobación.

### Sin cambios de código en esta capa

Este turno es **solo lectura** — genera reporte + screenshots. El código se toca hasta que apruebes el Lote 6.

### Siguiente paso propuesto tras Tranche D

Cerrar el ciclo con un **reporte consolidado** (`docs/ui-audit/99-resumen.md`) que liste todos los lotes aplicados (3, 4, 5, 6) y el delta antes/después por métricas transversales de Capa 1 (colores hardcodeados, anchos fijos, densidades). Ese resumen queda para el turno posterior al Lote 6.
