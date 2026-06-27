# Auditoría visual UI/UX @ 1920×1080 — plan de remediación

Capturé 12 rutas a 1920×1080 (`inicio`, `embarques`, `cotizaciones`, `clientes`, `proveedores`, `facturacion`, `cxp`, `costeo/tarifas`, `auditoria`, `usuarios`, `configuracion`, `crm`) y un auditor senior las inspeccionó pixel a pixel. **20 hallazgos**: 4 críticos, 5 altos, 6 medios, 5 bajos. Los módulos más “parchados” son **CRM** y **Configuración**; los más cohesionados son **Embarques** e **Inicio**.

Propongo agrupar las correcciones en **4 batches** ordenados por impacto en cohesión. Cada batch es un commit independiente con bump de versión y entrada en `CHANGELOG.md`.

---

## Batch 1 — Cohesión estructural (CRITICAL)

Cambios de mayor impacto visual: 4 archivos, ~1 día.

1. **C-01 · Badge del sidebar invade contenido.** El contador rojo "17" en "Embarques" se sale del sidebar (`-right-1` con sidebar de 254 px). → `right-2` en el badge + `overflow-x: hidden` en el contenedor del nav (`src/components/ui/sidebar.tsx` y/o `SidebarNavItem`).
2. **C-02 · CxP/Proveedores: columna "Proveedor" trunca el nombre y rompe la altura de fila.** Badge "Nacional/Extranjero" salta a segunda línea. → en la celda: `flex items-center gap-2 min-w-0`, nombre con `truncate max-w-[220px]`, columna `min-w-[280px]`. Aplicar mismo patrón en tabla de `cxp` y `proveedores`.
3. **C-03 · Facturación: el acordeón "¿Cómo funciona este módulo?" desplaza la barra de KPIs.** Rompe la jerarquía título → KPIs → filtros → tabla que usa el resto de la app. → mover el acordeón **debajo** de `<KpiStrip>` o convertirlo en un botón de ayuda `<HelpCircle>` que abre un `<Popover>`. Mantener orden: header → KPIs → filtros → tabla.
4. **C-04 · CRM: las pestañas viven en el topbar global, no en el contenido.** Ningún otro módulo hace eso. → mover `<TabsList>` (Mi día, Resumen, Leads, …) al área de contenido bajo el `<PageHeader>`, mismo patrón que Proveedores/CxP.

**Riesgo:** el cambio de CRM toca routing interno del feature; verificar que los `<Outlet>`/`useNavigate` sigan apuntando a las rutas hijas.

---

## Batch 2 — Sistema de tablas y headers (HIGH)

Toca tabla compartida `DataTable` y `PageHeader`. ~1 día.

5. **H-01 · Tabla de Embarques: columna CLIENTE acapara 35% del ancho.** ETD/ETA quedan apretados, ESTADO pegado al borde. → declarar widths explícitos en `columnsEmbarques.tsx`: `EXPEDIENTE w-[130px]`, `BL_MASTER w-[140px]`, `CONTENEDORES w-[120px]`, `CLIENTE w-[220px] max-w-[220px]`, `MODO w-[90px]`, `ORIGEN/DESTINO w-[120px]`, `ETD/ETA w-[100px]`, `ESTADO w-[110px]`. Agregar `table-fixed` en la `<table>` del `DataTable` compartido.
6. **H-02 · Cotizaciones: dos CTAs con peso visual de primario.** "+ Nueva Cotización" (filled) y "+ Nuevo Tarifario" (outline pero con `+`) compiten. → "Nuevo Tarifario" → `variant="outline"`, icono `FileSpreadsheet`, sin `+`.
7. **H-03 · Inicio: pipeline de embarques con padding asimétrico y segunda fila de KPIs sin card.** → padding uniforme `p-6` en ambas filas; envolver la segunda fila ("Arribos / MXN 267.4K …") en el mismo `<Card>` con `shadow-card`.
8. **H-04 · Configuración: botón "Sin Cambios" con estilo de primario.** Implica acción cuando es estado pasivo. → cuando `!isDirty`: `variant="outline" disabled`, gris muted. Sólo `variant="default"` cuando hay cambios.
9. **H-05 · Auditoría: cards "Salud operativa" y "Atención de hallazgos" con alturas distintas y pesos tipográficos disparejos.** → contenedor interno `h-full flex flex-col justify-between`; metric numeral estandarizado a `text-5xl font-bold` (token único del sistema).

**Riesgo bajo:** todos son ajustes presentacionales, no tocan negocio.

---

## Batch 3 — Sistema de componentes (MEDIUM)

El batch que más empuja la cohesión a largo plazo. ~1 día.

10. **M-01 · Tabs: dos variantes coexisten.** Underline (`proveedores`, `cxp`) vs segmentado-pastilla (`usuarios`, `auditoria`). → adoptar **una sola variante "underline"** en `<Tabs>` de shadcn para tabs de módulo. Auditar los 5 módulos tabulados y unificar.
11. **M-02 · CxP: barra de filtros mezcla pills, selects y "Filtros" en alturas distintas.** Dos "Todas" ambiguas. → todos los controles `h-9`; `<ToggleGroup>` para filtros mutuamente excluyentes; `<Select>` con label visible; renombrar "Todas" → "Todas las monedas" / "Todas las aprobaciones".
12. **M-03 · Clientes: search a ancho completo (1664 px) sin filtros.** Inconsistente con embarques/cotizaciones/proveedores. → cap `max-w-[600px]` y traer los CTAs "Importar CSV" + "Nuevo cliente" desde el topbar al toolbar.
13. **M-04 · Costeo/Tarifas: badges "Mejor"/"Nueva" outline mientras el resto usa filled.** → adoptar vocabulario único: `outline` para etiquetas tipo (Nacional/Tarifario), `filled` para estado (Aceptada/En Tránsito/Vencida) y para features (Mejor=green filled, Nueva=blue filled).
14. **M-05 · Usuarios: ~62% del alto vacío con 8 usuarios.** → footer con resumen ("8 de 8 · 5 roles"), o card "Invitar usuario" cuando `total < 10`. `min-h-[calc(100vh-64px)]` + flex column.
15. **M-06 · Facturación: KPIs con verde/rojo sin leyenda.** Cobrado=Vencido (mismos MXN 737.8K) en colores distintos confunde. → agregar `border-l-4 border-{green,red}-500` al `<Card>` del KPI (cue estructural) + tooltip explicativo.

**Riesgo:** unificar tabs implica tocar componente compartido `Tabs`; ejecutar Playwright sobre los 5 módulos tabulados para verificar que el indicador activo se renderice bien.

---

## Batch 4 — Pulido fino (LOW)

Quick wins, ~½ día.

16. **L-01 · Subtítulos de página inconsistentes** → token único `text-sm text-muted-foreground mt-0.5 leading-snug` en `<PageHeader>` (corolario: migrar los **30 archivos** que aún usan `<h1>` crudo en lugar de `<PageHeader>` — listado ya identificado).
17. **L-02 · Inicio: chip "41 embarques activos" flota entre topbar y contenido** → moverlo inline al `<PageHeader>` con `flex items-center gap-3`.
18. **L-03 · CRM: KPI "Pipeline ponderado" se desnivela por wrap del label** → label `text-xs text-nowrap`, mini-cards `h-[72px]` fijo.
19. **L-04 · Configuración: badge "enterprise" estilo `<span>` default** → `<Badge variant="outline" className="capitalize text-indigo-600 border-indigo-300 bg-indigo-50">Enterprise</Badge>`.
20. **L-05 · Topbar search casi invisible sobre fondo blanco** → `bg-muted/40 border border-input` para garantizar contraste ≥3:1.

---

## Tareas transversales (al cerrar los 4 batches)

- **Migrar 30 rutas con `<h1>` crudo a `<PageHeader>`** (`rg -l "<h1 " src/features -g '*.tsx'`) — necesario para que L-01 sea estructural y no decorativo.
- **Añadir un test de regresión visual ligero** (Playwright + screenshot diff) en al menos las 3 rutas más críticas (`/inicio`, `/embarques`, `/cxp`) a 1920×1080 para que próximos PRs no rompan cohesión.
- **Bump de versión por batch** (`13.139.14` → `13.139.17`) y entrada en `CHANGELOG.md` por cada uno.

---

## Detalles técnicos (sección extendida)

**Tokens ya disponibles en `index.css`** (verificado): paleta KPI categórica (`--kpi-info/success/accent/warning/secondary/danger` con variantes `-soft`), sombras de tarjeta (`--shadow-card/raised/overlay`), radios (`--radius-sm/lg`), estados de embarque (`--state-llegada/en-proceso/cerrado`), sidebar con variantes claro/oscuro. **No hace falta crear tokens nuevos** — los hallazgos se resuelven usando los existentes consistentemente.

**Inventario de componentes compartidos**: 36 piezas en `src/components/shared/` (incluyen `PageHeader`, `KpiStrip`, `DataTable`, `FormDialogShell`, `FloatingActionButton`). El UI kit existe y es robusto; el problema es **adopción inconsistente** (60 usos de `PageHeader` vs 30 archivos con `<h1>` crudo, dos variantes de Tabs coexistiendo, dos formas distintas de pintar el mismo badge).

**Estrategia de ejecución**: implementar en orden Batch 1 → 4. Después de cada batch, recapturar las 12 screenshots a 1920×1080 y comparar antes/después para validar que no haya regresión visual en otras rutas. El reporte completo del auditor (con regiones específicas y fixes Tailwind por hallazgo) queda disponible para usar como referencia durante la implementación.

**Resultado esperado**: app que se ve construida por un solo sistema de diseño, sin "patched-on" modules. Cohesión visual completa en 3–4 días de trabajo.