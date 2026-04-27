
# Auditoría Visual de Libre Carga — Hallazgos y Plan de Trabajo

Inspeccioné las pantallas principales (Dashboard, Embarques, Cotizaciones, Clientes, Operaciones, Pre-Facturación, Detalle de Embarque) en escritorio (1366×768) y móvil (360×800) en modo oscuro. Documento abajo los hallazgos por severidad y propongo un plan en 3 fases.

---

## Hallazgos por pantalla

### 1. Dashboard principal (`/`)
- **Crítico — barras "Cargas activas por cliente" invisibles:** las mini-barras de proporción usan `bg-muted` + `bg-primary/40`; en modo oscuro ambos son tonos azul-marino muy cercanos, las barras se ven como guiones grises planos. Sin contraste, no comunican proporción.
- **Importante — Tabla "Embarques":** el badge "En Tránsito" se rompe en 2 líneas; los badges de estado deberían ser `whitespace-nowrap`.
- **Importante — Capitalización de fecha:** "Domingo, 26 De Abril De 2026" — las preposiciones "de" no deben ir capitalizadas; `toLocaleDateString` + CSS `capitalize` aplica title-case a TODAS las palabras. Debe usarse `first-letter:uppercase` o normalizar la cadena manualmente.
- **Importante — Mobile (360px):** los 5 KPIs de estado solo muestran 2; el resto queda fuera de pantalla sin scroll horizontal evidente. La línea conectora en `DashboardStatusCards` fuerza un layout flex sin wrap. KPI "Arribos este mes" trunca "USD 20,774…".

### 2. Lista de Embarques (`/embarques`)
- **Crítico — inputs `<input type="date">` muestran placeholder "mm/dd/yyyy"** en vez de DD/MM/YYYY (incumple memoria de localización mexicana).
- **Crítico — desbordamiento horizontal:** la tabla rebasa el ancho del contenedor; columna ESTADO se corta ("En Trán…", "Confir…"). Falta `min-w` en la columna o `overflow-x-auto` con scroll cómodo, y los badges pegados al borde.
- **Importante — Selects truncados:** "Todos los..." ocupa el botón y no se ve qué se filtra.
- **Menor — iconos de alerta amarillos sin tooltip visible** junto a expediente; no es claro qué alertan.

### 3. Lista de Cotizaciones (`/cotizaciones`)
- **Crítico — Folio se rompe en 3 líneas** ("COT-/2026-/0058"); falta `whitespace-nowrap` o `tabular-nums` en columna FOLIO.
- **Importante — Modo sin icono** (a diferencia de embarques) — inconsistencia con el resto del sistema.
- **Importante — KPI cards desbalanceadas:** los iconos circulares grandes a la izquierda dejan mucho espacio vacío arriba/abajo; números desalineados respecto a la etiqueta.
- **Menor — Selects truncados** ("Todos los...").

### 4. Clientes (`/clientes`)
- **Importante — Capitalización inconsistente** en columna CONTACTO ("EDUARDO VARGAS1" vs "Yuliana Reyes"). Conviene normalizar a Title Case en presentación.
- **Importante — Teléfono sin formato** ("5553083347" vs "+52 1 442 170 6966" vs vacío). Falta máscara/formatter (`+52 555 308 3347`).
- **Menor — Ciudades en MAYÚSCULAS sin acentos**; aplicar Title Case en render.

### 5. Operaciones (`/operaciones`)
- **Crítico — Gráfica de barras apiladas con etiquetas X rotadas** mostrando emails completos (`alan.hernandez@elogistixshipping.com`) que **se solapan con la leyenda** ("Confirmado · En Tránsito · Llegada…"). Caos visual.
- **Solución:** mostrar nombre/inicial en eje X (no email), dar `bottom margin` mayor, mover leyenda arriba.

### 6. Pre-Facturación (`/facturacion`)
- **Crítico — # Proforma se rompe en 2 líneas** ("PRO-2026-/0006"); igual problema que cotizaciones.
- **Crítico — Columna MONTO se corta** (solo se ve "USD"); tabla rebasa contenedor.
- **Importante — Operador es email completo** en vez de nombre; reduce legibilidad.
- **Importante — Badge "Consolidada (2)" en 2 líneas** por el paréntesis.

### 7. Detalle de Embarque (`/embarques/:id`)
- **Importante — Jerarquía del header confusa:** badge "SIN PROFORMA" amarillo grueso compite visualmente con el CTA primario "Avanzar a En Aduana", y el nombre del cliente queda debajo del badge en gris pequeño.
- **Importante — Toolbar con 6 botones** apretada — agrupar acciones secundarias (Duplicar, Compartir Tracking, Imprimir) en menú "•••".
- **Menor — Inconsistencia de moneda en tab Costos:** KPIs ("$6,073.24") sin prefijo USD, pero las tablas debajo sí lo muestran ("USD 350.00").

### 8. Loader de rutas (transversal)
- **Importante — `RouteLoadingFallback` ocupa toda la pantalla** y oculta sidebar/header al navegar entre páginas; rompe la sensación de continuidad. Debería ocupar solo el área `<main>`.

---

## Plan de Trabajo (3 fases)

### Fase 1 — Correcciones críticas (alto impacto visual)
1. **Dashboard / CargasActivasClienteCard**: cambiar barra a `bg-secondary` + `bg-primary` (sólido), aumentar a `h-2.5`, añadir borde sutil para asegurar contraste en dark.
2. **Localización de fechas**: reemplazar `<input type="date">` por componente `Calendar/Popover` ya disponible en shadcn (formato DD/MM/YYYY) en filtros de Embarques y otros.
3. **Capitalización de fecha header dashboard**: normalizar manualmente ("domingo, 26 de abril de 2026" → con sólo primera letra capitalizada) en `Dashboard.tsx` en lugar de CSS `capitalize`.
4. **Folios y números de proforma**: añadir `whitespace-nowrap` a las columnas FOLIO/EXPEDIENTE/# PROFORMA en `clienteColumns.tsx`, columnas de cotizaciones y proformas. Aplicar mínimo ancho `min-w-[110px]`.
5. **Tablas con desbordamiento (Embarques, Pre-Facturación)**: revisar `DataTable` para asegurar scroll horizontal cómodo con `overflow-x-auto` + ancho mínimo en columnas críticas (ESTADO, MONTO).
6. **Operaciones — gráfica `DesempenoOperadores`**: extraer nombre del email (`split('@')[0]`), aumentar margen inferior, mover leyenda al top.
7. **RouteLoadingFallback**: contener dentro del `<main>` para preservar shell (sidebar + header).

### Fase 2 — Mejoras de consistencia
8. **Badges de estado**: `whitespace-nowrap` global en `getEstadoColor` o en componente Badge wrapper.
9. **Selects truncados**: aumentar `min-width` de los SelectTrigger en filtros (mínimo 160px) o usar etiquetas más cortas ("Estado", "Modo").
10. **Operador (email → nombre)** en tablas de Pre-Facturación: helper que convierta `alan.hernandez@…` a "Alan Hernández".
11. **Mobile de DashboardStatusCards**: permitir `flex-wrap` o convertir a grid 2 columnas en móvil; ocultar la línea conectora en breakpoints `<sm`.
12. **Header de Detalle de Embarque**: rediseñar a un layout vertical claro — nombre cliente como subtítulo grande debajo del expediente; badge "SIN PROFORMA" como `variant="outline"` más delgado; agrupar acciones secundarias en un menú "Más".

### Fase 3 — Pulido
13. **Capitalización de nombres** (clientes, contactos, ciudades): pequeño helper `toTitleCase` aplicado en columnas de presentación.
14. **Formato de teléfono** mexicano consistente (helper `formatPhoneMx`).
15. **Consistencia de moneda en KPIs de Costos**: añadir prefijo "USD" a los KPIs de "Total Venta / Total Costo / Utilidad" para alinearlos con las tablas.
16. **Tooltip en iconos de alerta** de la lista de embarques explicando qué documentación falta.
17. **Iconos de modo en Cotizaciones** (mismo patrón que embarques).

### Cambios de soporte
- Actualizar `src/pages/Changelog.tsx` con una entrada nueva por cada fase entregada.

---

## Detalles técnicos relevantes

- Las barras grises del Dashboard se deben a clases `bg-muted` + `bg-primary/40` en `CargasActivasClienteCard.tsx` (línea 86-90); la solución es subir el contraste y eliminar la opacidad.
- El loader global está en `src/components/layout/RouteLoadingFallback.tsx` y se monta como Suspense fallback en `App.tsx`; se debe envolver el `Outlet` en su propio Suspense dentro del `Layout`.
- Las tablas usan `DataTable` (`src/components/shared/DataTable.tsx`); validar si el wrapper tiene `overflow-x-auto` y si las celdas críticas heredan `whitespace-nowrap`.
- La gráfica de Operaciones (`src/components/operaciones/DesempenoOperadores.tsx`) usa probablemente Recharts; transformar `dataKey` del eje X a un campo derivado `nombreCorto`.

¿Procedo en orden de fases o prefieres priorizar algún hallazgo en particular?
