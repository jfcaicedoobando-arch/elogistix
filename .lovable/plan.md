

## Plan de Mejora Visual UI/UX

Tras revisar todas las páginas y componentes, identifico las siguientes areas de mejora organizadas en archivos a modificar. **No se modifica ninguna funcionalidad ni lógica.**

---

### Cambios Globales

**`src/index.css`** — Sistema de diseño base
- Agregar clases utilitarias para consistencia: `.page-header`, `.page-container`, `.section-gap`
- Mejorar la fuente base con `antialiased` y `font-feature-settings`
- Agregar estilos para mejorar tablas: filas con hover más suave, header con fondo sutil
- Mejorar el scrollbar en modo oscuro/claro

**`src/components/ui/table.tsx`** — Tablas más limpias
- Header con fondo `bg-muted/50` para separar visualmente del cuerpo
- Celdas con padding más uniforme (`px-4 py-3`)
- Texto del header con `uppercase text-[11px] tracking-wider` para jerarquia clara
- Filas con transición de hover más suave

**`src/components/ui/badge.tsx`** — Badges más refinados
- Reducir `font-semibold` a `font-medium` para aspecto más limpio
- Ajustar `px-2.5 py-0.5` a `px-2 py-0.5` para proporción más compacta

---

### Cambios por Página

**`src/components/Layout.tsx`** — Header global
- Aumentar altura del header de `h-14` a `h-16`
- Agregar `shadow-sm` sutil para separación visual
- Mejorar el texto del header con mejor tipografia

**`src/pages/Dashboard.tsx`** — Panel principal
- KPI cards: agregar borde izquierdo de color (`border-l-4`) por categoría para diferenciarlos
- Titulo de secciones de `text-base` a `text-sm font-semibold uppercase tracking-wide text-muted-foreground` para jerarquía
- Tabla de embarques recientes: agregar clase de texto más pequeño y uniforme

**`src/pages/Embarques.tsx`** — Listado de embarques
- Filtros: mejorar el `gap-3` a `gap-4` y agregar separador visual
- Tabla: uniformizar tamaños de texto en celdas

**`src/pages/Cotizaciones.tsx`** — Listado de cotizaciones
- Mismos ajustes de filtros y tabla que Embarques para consistencia

**`src/pages/Clientes.tsx`** — Listado de clientes
- Agregar subtítulo con conteo como en Embarques
- Dialog de nuevo cliente: mejorar espaciado del formulario

**`src/pages/Proveedores.tsx`** — Listado de proveedores
- TabsList: mejorar wrapping con `grid` en lugar de `flex` para tablet
- Consistencia en header con subtítulo

**`src/pages/Facturacion.tsx`** — Facturación
- Agregar subtítulo descriptivo
- Tabs más prominentes

**`src/pages/Reportes.tsx`** — Reportes
- KPI cards: agregar el mismo patrón de borde izquierdo del Dashboard
- Agregar subtítulo

**`src/pages/Login.tsx`** — Pantalla de login
- Reemplazar el icono `Anchor` por el logo de eLogistix
- Agregar fondo con gradiente sutil
- Card con `shadow-lg` y más padding

**`src/pages/NuevoEmbarque.tsx` y `src/pages/NuevaCotizacion.tsx`** — Formularios
- Botones de navegación con más separación visual
- Header del formulario con subtitulo descriptivo consistente

**`src/pages/EmbarqueDetalle.tsx`** — Detalle de embarque
- Tabs con más espacio entre pestañas
- Header con mejor alineación vertical

**`src/pages/Configuracion.tsx`** — Configuración
- Cards con padding más generoso
- Labels con mejor espaciado vertical

**`src/components/AppSidebar.tsx`** — Sidebar
- Logo con fondo blanco redondeado para contraste
- Items del menú con más padding vertical
- Footer con separación más clara

**`src/components/embarque/DetailRow.tsx`** — Filas de detalle
- Mejorar contraste y espaciado

**`src/components/embarque/TabCostos.tsx`** — Tab de costos
- KPI cards con borde izquierdo de color
- Tablas con mejor formato

**`src/components/SearchInput.tsx`** — Campo de búsqueda
- Agregar fondo `bg-muted/30` para destacar visualmente
- Borde más redondeado

**`src/components/PaginationControls.tsx`** — Paginación
- Centrar mejor los elementos
- Mejorar estilo de los botones

---

### Archivos afectados (17 archivos)

```text
src/index.css
src/components/ui/table.tsx
src/components/ui/badge.tsx
src/components/Layout.tsx
src/components/AppSidebar.tsx
src/components/SearchInput.tsx
src/components/PaginationControls.tsx
src/components/embarque/DetailRow.tsx
src/components/embarque/TabCostos.tsx
src/pages/Dashboard.tsx
src/pages/Embarques.tsx
src/pages/Cotizaciones.tsx
src/pages/Clientes.tsx
src/pages/Proveedores.tsx
src/pages/Facturacion.tsx
src/pages/Reportes.tsx
src/pages/Login.tsx
```

### Principios aplicados
- Todos los títulos de página: `text-2xl font-bold` + subtítulo en `text-sm text-muted-foreground`
- Todas las tablas: header con fondo, texto uppercase 11px tracking-wide
- Todos los KPI cards: borde izquierdo de color para identidad visual
- Todos los filtros: gap-4 consistente, inputs con fondo sutil
- Todas las secciones: `space-y-6` uniforme entre bloques principales

