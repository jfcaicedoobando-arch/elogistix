## Auditoría visual (768 × 1024, tableta vertical)

Capturé las tres páginas con Playwright a 768 px de ancho — el punto crítico donde Tailwind cambia de `sm` a `md`. Analogía: es la "hora pico" del layout: si algo va a romperse, se rompe aquí.

### 1) `/proformas` — Listado

Problemas encontrados:
- **Filtros comprimidos**: la fila `search + 2 selects "Todos..." + filtros + Exportar CSV` queda apretada; los selects muestran texto truncado ("Todos..."). El botón de filtros aparece como icono suelto sin etiqueta.
- **Tabla con scroll horizontal**: 7-8 columnas no caben; el usuario pierde de vista Estado/Monto/Acciones al scrollear a la derecha. La columna sticky "# Proforma" ayuda pero solo parcialmente.
- **Descripción del header** ocupa 2 renglones largos innecesarios en tableta.

### 2) `/facturacion`

Problemas encontrados:
- **Card de KPIs top stack vertical**: los 5-6 indicadores (Por timbrar, Facturado mes, Cobrado mes, Por cobrar, Vencido, Últimos 6 meses) se apilan uno debajo del otro con muchísimo whitespace. En tableta caben cómodamente en 2-3 columnas.
- **Barra de filtros en 2 renglones**: `Todos los estados` + `Todos los clientes` + `Exportar` + `Filtros` + `Mostrando X` se envuelve inconsistente.
- **Chip "Hueco: 42 · USD… · MXN…"** en la barra de Tabs (Emitidas / Notas de crédito) rompe el renglón: la etiqueta larga empuja las tabs hacia arriba.
- **Tabla Emitidas** también con scroll horizontal amplio.

### 3) `/cartera`

Problemas encontrados:
- Los 3 KPI cards se ven bien (grid ya usa `md:grid-cols-3`).
- **Título del header en la topbar aparece en minúscula** ("cartera") — inconsistente con el resto ("Proformas", "Facturación").
- **Tabla con scroll horizontal**: la columna `Total` queda cortada; `Días vencido` envuelve encabezado en 2 líneas.
- **Nombres de cliente largos** se envuelven en 3 líneas (ENTERA SALUD ANIMAL Y NUTRICION S.A. DE C.V) inflando la altura de la fila; falta `line-clamp-2` + tooltip.

---

## Fixes propuestos (priorizados, solo UI/presentación)

### A. Proformas (`TabProformas` + `ProformasFiltros`)
1. Reorganizar barra de filtros: `search` a ancho completo en tableta, y en un segundo renglón compacto `[Estado][Cliente][Filtros] · [Exportar CSV]` con `flex-wrap` limpio y labels visibles en selects (no "Todos...").
2. En tabla: reducir padding lateral de celdas en tableta (`md:px-2`) y bajar `Operador`/`Fecha` a texto `xs` — hoy ya es `xs` pero la columna Operador se lleva 140 px que se puede reducir a 110.
3. Reemplazar la descripción larga del header por versión corta en `md` (`hidden md:block` vs `sm:hidden`) — o simplemente permitirle 1 sola línea con `line-clamp-1`.

### B. Facturación (`Facturacion.tsx` + card de dashboard)
1. Convertir el card superior de KPIs a `grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3` (mismo patrón que usan `FacturacionKpisFiscales`). Cada KPI queda como tile compacto.
2. En la fila de filtros: unificar todo en un `flex flex-wrap gap-2 items-center` con orden `[search grow][Estado][Cliente][Filtros] … [Exportar]`.
3. Mover el chip **"Hueco: 42 · USD… · MXN…"** a debajo de los tabs (línea propia) o compactarlo a `Hueco: 42` con tooltip para los montos, evitando que compita con Emitidas / Notas de crédito.
4. Alinear `Nueva factura manual` como botón secundario en tableta si empuja el layout.

### C. Cartera (`Cartera.tsx`)
1. Corregir el título de la topbar → "Cartera" (`Title Case`); revisar `Breadcrumbs`/`routeMeta`.
2. Truncar nombres de cliente: `line-clamp-2` + `title={cliente}` para tooltip nativo.
3. Ajustar columna Cliente a `min-w-[160px] max-w-[220px]`.
4. Encabezado "Días vencido" → una sola línea con `whitespace-nowrap`.

---

## Fuera de alcance
- No se toca lógica de datos, hooks, RLS, ni filtros de negocio.
- No se rediseñan las tres páginas: son ajustes de responsive puntuales.
- No se agregan librerías nuevas.

## Verificación
- Re-capturar los 3 screenshots en tableta (768 × 1024) y en móvil (390 × 844).
- `bun run lint` limpio.
- Bump `APP_VERSION` a `13.172.3` + entrada en `CHANGELOG.md`.

## Nota
Si querés que te muestre **prototipos visuales** de los 3 fixes antes de implementar (útil sobre todo para la barra de KPIs de Facturación), decímelo y lanzo el flujo de "design directions". Si no, arranco directo con los ajustes.