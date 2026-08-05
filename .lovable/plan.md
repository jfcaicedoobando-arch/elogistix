# Armonización visual global del ERP

El sistema de diseño ya existe y está bastante maduro: tokens semánticos en `index.css` + `tailwind.config.ts` (primary, success, warning, info, destructive, kpi.*, state.*, aging.*), escala tipográfica (`display`, `kpi`, `label`, `2xs`, `3xs`) y componentes canónicos (`PageContainer`, `PageHeader`, `DataTable`, `KpiCard`, `FormDialogShell`, `Button` con 7 variantes).

Lo que falta no es crear el sistema, es **cerrar la deriva**: hay módulos que todavía no consumen los componentes canónicos y quedan estilos sueltos. Datos medidos hoy:

- 75 pantallas usan `PageHeader`, 79 usan `PageContainer` — pero 65 archivos aplican su propio `p-4`/`p-6` y 14 archivos declaran su propio `<h1>`.
- 5 archivos usan clases de paleta cruda (`bg-white`, `text-gray-*`): `ui/alert-dialog`, `ui/sheet`, y 3 de marketing/landing.
- 3 archivos con hex literal (2 son legítimos: generador PDF y preview de logo).
- ~14 archivos con `rounded-[…]`/`shadow-[…]` arbitrarios y ~200 usos de anchos `w-[NNpx]` concentrados en definiciones de columnas de tablas.

## Alcance

Incluye toda la app interna (Embarques, Cotizaciones, Facturación, CxP/Compras, Tesorería, Cobranza, CRM, Auditoría, Profit, Admin, Portal de cliente, Configuración) y el shell (sidebar, header, breadcrumbs, buscador global).

Se excluye el sitio de marketing/landing y las páginas legales, que tienen su propia identidad de página pública, salvo el reemplazo de paleta cruda por tokens para que respondan a dark mode.

## Fases

### Fase 1 — Cierre de tokens (base)
- Reemplazar paleta cruda por tokens semánticos en `ui/alert-dialog`, `ui/sheet` y los 3 archivos de marketing (queda `LogoPreview`, que necesita hex por ser previsualización de marca).
- Sustituir `rounded-[…]`/`shadow-[…]` arbitrarios por `rounded-sm|md|lg|xl` y `shadow-card|raised`.
- Auditar que status colors se usen siempre por su token semántico (`text-success`, `bg-warning/10`, `border-destructive`) y no por color de la paleta base.

### Fase 2 — Rejilla y encabezados
- Migrar los archivos con padding propio a `PageContainer` (`p-4 sm:p-6`), eliminando doble padding.
- Migrar los `<h1>` sueltos de la app interna a `PageHeader`; consolidar `H2/H3` en `DocumentoSectionTitle` / `FormDialogSection`.
- Normalizar espaciados a la rejilla de 8 px: `gap-2 / gap-4 / gap-6`, `space-y-4 / space-y-6`; quitar valores intermedios sueltos (`gap-[10px]`, `mt-[6px]`).
- Igualar altura de header (44/48 px), alineación de breadcrumbs y separación header→contenido en todas las vistas.

### Fase 3 — Patrones núcleo
- **Tablas**: un solo formato de encabezado (mayúsculas, `text-label`, tabular-nums en numéricos), hover y zebra idénticos, `PaginationControls` y selector de densidad en todos los listados, y estados vacío/carga/error siempre vía `DataTableBodyEmpty` / `ListSkeleton` / `ErrorState`. Las columnas con `w-[NNpx]` pasan a un set fijo de anchos tokenizados (`COL_W.money`, `COL_W.fecha`, `COL_W.folio`, `COL_W.acciones`).
- **Formularios**: todos los inputs, selects, datepickers (`DatePickerMx`), buscadores y modales comparten borde, focus ring, placeholder y patrón de error inline vía `FormField`. Modales tipo formulario siempre en `FormDialogShell`.
- **KPIs**: un único `KpiCard` (valor, delta con flecha, ícono, variante semántica) en dashboards de Inicio, Compras, Cobranza, Tesorería, Profit, Auditoría y Portal; se retiran clones locales.
- **Shell**: estados activos del sidebar, expansión de subgrupos, badges de alertas y buscador global consistentes en 1280/1440/1920.

### Fase 4 — Micro-interacciones
- Jerarquía única de botones por pantalla: una sola CTA `default`, resto `outline`/`ghost`; destructivas siempre `destructive` + doble confirmación.
- Transiciones unificadas (`transition-colors duration-150`), estados disabled/loading con spinner y texto en gerundio, skeletons con la misma forma que el contenido final.

### Fase 5 — Guardas y verificación
- Extender el script de auditoría de arquitectura con reglas nuevas: prohibido hex literal y clases de paleta cruda en `src/features/**`, prohibido `p-4`/`p-6` en la raíz de una ruta que ya use `PageContainer`, prohibido `<h1>` fuera de `PageHeader` en la app interna. Con esto la coherencia no se vuelve a perder.
- Verificación visual con Playwright a 1920×1080 de una pantalla representativa por familia (listado, detalle, dashboard, wizard, modal de captura, portal), light y dark.
- Tests de render de los componentes compartidos tocados y ejecución de la suite existente.

## Detalles técnicos

- Nuevo módulo `src/components/shared/dataTable/columnWidths.ts` con el set de anchos tokenizados; las ~25 definiciones de columnas lo consumen.
- `PageHeader` y `PageContainer` se dejan como única fuente de padding y `<h1>`; `Layout.tsx` sigue montando `PageContainer noSpacing`.
- Reglas nuevas en `scripts/audit-architecture.ts` (+ tests en `src/__tests__/architecture/`), sin bajar umbrales de cobertura existentes.
- Sin cambios de backend, lógica de negocio, cálculos ni RPCs: el trabajo es exclusivamente de presentación.
- Se registra cada lote en `CHANGELOG.md` y se sube `APP_VERSION` (serie `13.424.x`).

## Entrega

Se ejecuta por fases, con la suite de tests y la verificación visual al cierre de cada una, para poder revisar avances sin esperar el total.
