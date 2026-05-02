
# Pulido visual UI/UX (modo escritorio) — v8.101.0

Implementación de los 11 hallazgos críticos / altos / pulido fino detectados en la auditoría visual previa. Todos los cambios son quirúrgicos y no tocan lógica de negocio. Resultado: app más consistente, simétrica y "Apple-like".

## Cambios concretos

### 1. Sidebar item activo más sutil
`src/components/layout/SidebarGroupBlock.tsx` — el item activo ya no se pinta con el azul-marino sólido (`bg-sidebar-accent`), pasa a `bg-sidebar-accent/10 + text-sidebar-foreground font-semibold`. Conserva el indicador lateral azul (3 px) que ya existe. Resultado: barra de navegación menos pesada en light mode.

### 2. Header sticky reforzado
`src/components/layout/Layout.tsx` — sube `z-30` → `z-40` y aumenta opacidad del fondo (`bg-card/95`) para que el sub-header del detalle no se vea cortado al hacer scroll. Borde inferior con tono fijo (`border-border/60`).

### 3. Quitar botón "← back" redundante en EmbarqueDetalleHeader
Ya hay breadcrumb en el header global. Se elimina `<Button ArrowLeft>` y se simplifica el contenedor flex.

### 4. Igualar alturas en TabResumen
Las cards "Datos Generales" y "Ruta y Transporte" usaban grid sin `auto-rows-fr`. Ahora ambas tienen `h-full` y el grid declara `auto-rows-fr` para alturas idénticas. Mismo fix para Shipper/Consignatario.

### 5. Reportes: columna Margen ya no se corta
`src/pages/dashboard/Reportes.tsx` deja de usar `grid lg:grid-cols-5` y pone chart + tabla apilados verticalmente full-width. `ReportesTablaClientes` quita su `lg:col-span-3`. La tabla tiene espacio para las 6 columnas sin scroll horizontal.

### 6. Pre-Facturación: diferenciar tabs anidados
En `src/components/facturacion/TabProformas.tsx` el segundo nivel de Tabs (Todas/Pendientes/Facturadas) se reemplaza por un `ToggleGroup` outline (estilo segmented control con borde) — visualmente distinto del Tabs principal de la página, deja claro que es un filtro y no navegación.

### 7. Logo del sidebar sin contenedor blanco en light
`src/components/layout/AppSidebar.tsx` — `bg-white p-1 ring-1` se aplica solo en dark mode. En light el logo se renderiza directo sobre el sidebar.

### 8. Avatar usuario sidebar con fondo neutro
Mismo archivo — `bg-sidebar-accent` (azul marino sólido) → `bg-muted text-foreground`. Avatar más discreto, alineado con el resto del sidebar light.

### 9. Breadcrumb: placeholder mientras se resuelve UUID
`src/components/layout/Breadcrumbs.tsx` — cuando el segmento es un UUID (36 chars con guiones) y aún no hay label dinámico registrado, mostrar `…` en lugar del UUID truncado. Evita el flash feo de `009ba3b0-ab4b-…`.

### 10. Skeleton de página completa
`src/components/layout/RouteLoadingFallback.tsx` — reemplaza el spinner centrado por un skeleton que respeta el layout (header skeleton + grid de cards skeleton). Sensación de carga más rápida y "premium".

### 11. Bump versión + Changelog
- `src/constants/appVersion.ts` → `8.101.0`
- Nueva entrada al inicio de `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` (versión 8.101.0, tipo `minor`, fecha 2026-05-02) describiendo los 10 ajustes visuales.

## Archivos a modificar (10)

```text
src/components/layout/SidebarGroupBlock.tsx        # sidebar activo sutil
src/components/layout/Layout.tsx                    # header z-40 + bg
src/components/layout/AppSidebar.tsx                # logo + avatar light
src/components/layout/Breadcrumbs.tsx               # placeholder UUID
src/components/layout/RouteLoadingFallback.tsx      # skeleton layout
src/components/embarque/EmbarqueDetalleHeader.tsx   # quitar back
src/components/embarque/TabResumen.tsx              # h-full auto-rows-fr
src/components/facturacion/TabProformas.tsx         # ToggleGroup
src/pages/dashboard/Reportes.tsx                    # layout vertical
src/components/reportes/ReportesTablaClientes.tsx   # quitar col-span-3
```

Y los 3 archivos de versión/changelog:
```text
src/constants/appVersion.ts
src/content/changelog/v8/chunks/0.ts
src/content/changelogData.ts
```

## Lo que NO se toca (a propósito)

- **KpiCard, Tabs, PageHeader** — ya son canónicos y se usan consistentemente. Lo que faltaba era aplicarlos bien (ya lo están). Solo el "doble-tab" de Pre-Facturación rompía y se arregla en el paso 6.
- **Theme toggle** — ya es `variant="ghost"`, no hace falta cambiarlo (el botón azul que vi antes era del avatar de menú, falso positivo).
- **Dashboard timeline KPI** — es intencional como vista hero del Dashboard y no compite con las KPI cards de las demás páginas (cumplen funciones distintas). Lo dejo.
- **Iconografía sidebar / tooltip ⚠️ / tabular-nums** — pulido muy fino, quedan para una v8.101.x posterior si quieres priorizarlos.

Una vez aprobado, ejecuto los 13 archivos en una sola pasada y dejo el changelog actualizado.
