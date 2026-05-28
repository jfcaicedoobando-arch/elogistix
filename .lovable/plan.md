# Rediseño Pre-Facturación

Mantengo toda la lógica de negocio intacta. Solo cambia presentación, copy y disposición de controles.

## A1 — Un solo selector temporal por contexto

El filtro **"Periodo: Desde → Hasta"** desaparece de la barra superior y se mueve **dentro de cada pestaña que lo usa** (Pendientes, Proformas, Facturas, Liquidación), como una fila compacta arriba de la tabla de esa pestaña.

En la pestaña **Proyección** solo se ve el selector de mes (`◀ Octubre 2026 ▶`). El rango Desde/Hasta NO aparece ahí.

Resultado: el usuario siempre ve **un solo control de fecha** y entiende a qué aplica.

Implementación:
- Quito el `<Card>` con `<DateRangeFilter>` de `Facturacion.tsx` (barra global).
- Inserto `<DateRangeFilter>` dentro de las 4 tabs que lo necesitan (no en Proyección).
- El estado `useFacturacionDateRange` se sigue compartiendo (sigue siendo un solo periodo recordado entre tabs).

## B1 — Pestañas numeradas siguiendo el flujo

```text
1. Proyección  →  2. Por aprobar  →  3. Proformas  →  4. Facturas emitidas  →  5. Pagos a proveedores
```

Mapping:
- `Proyección` → **"1. Proyección"**
- `Pendientes (n)` → **"2. Por aprobar (n)"**
- `Proformas` → **"3. Proformas"**
- `Facturas` → **"4. Facturas emitidas"**
- `Liquidación de Gastos` → **"5. Pagos a proveedores"**

Los `value` internos de los TabsTrigger se mantienen (`proyeccion`, `pendientes`, etc.) para no romper estado.

## B2 — Icono Info (?) con tooltip por pestaña

Cada `TabsTrigger` lleva un `<Info className="h-3 w-3 ml-1 opacity-60" />` con `<Tooltip>` que describe la pestaña en una línea:

- **1. Proyección** — "Cuánto vas a facturar este mes según los ETA de los embarques."
- **2. Por aprobar** — "Proformas generadas pendientes de revisión. Consolida y aprueba aquí."
- **3. Proformas** — "Histórico completo de proformas (pendientes y facturadas)."
- **4. Facturas emitidas** — "Facturas ya generadas. Export CSV y layout contable."
- **5. Pagos a proveedores** — "Costos de proveedores pendientes de pago (cuentas por pagar)."

Uso `Tooltip` de shadcn ya disponible en el proyecto.

## B3 — Guía colapsable "¿Cómo funciona este módulo?"

Justo debajo del `PageHeader`, antes del `Tabs`, agrego un `<Accordion type="single" collapsible>` con un solo item cerrado por defecto:

```
¿Cómo funciona este módulo?  ▼
```

Al abrir muestra:
- Un mini-diagrama de flujo horizontal con 5 pasos (1→2→3→4→5) usando iconos de lucide-react y bordes punteados (sólo CSS, sin librerías).
- 2 líneas explicando el ciclo: generación de proforma → aprobación/consolidación → emisión de factura → cobranza al cliente → pago al proveedor.
- Una nota corta sobre el Hueco de Facturación y qué significa.

Componente nuevo: `src/components/facturacion/GuiaPrefacturacion.tsx` (~80 LOC).

## C3 — Hueco de Facturación más compacto

Hoy es un banner grande con tipografía 3xl. Lo encojo a una sola fila:

- Altura ~52px (vs ~120px actual).
- Layout: `[⚠ icon] Hueco de Facturación · 3 embarques · USD $X · MXN $Y                              [Ver detalle →]`
- Mismo color destructivo, pero borde 1px (no 2px), padding `py-2.5 px-4`, sin barra lateral.
- El estado "sin hueco" se reduce a una línea verde de la misma altura.
- Sigue en la pestaña **Proyección**, arriba del selector de mes.

Edito `HuecoFacturacionCard.tsx` (componente existente, sin cambios en el hook ni en el dialog de detalle).

## Archivos afectados

1. `src/pages/facturacion/Facturacion.tsx` — quitar barra global de fechas, renombrar tabs, añadir `<GuiaPrefacturacion>`, añadir tooltips B2.
2. `src/components/facturacion/GuiaPrefacturacion.tsx` — **nuevo**, accordion con diagrama.
3. `src/components/facturacion/HuecoFacturacionCard.tsx` — versión compacta C3.
4. `src/components/facturacion/TabProformas.tsx` — insertar `<DateRangeFilter>` arriba de la tabla.
5. `src/components/facturacion/TabProformasPendientes.tsx` — insertar `<DateRangeFilter>` arriba.
6. Pestañas inline "Facturas" y "Liquidación" en `Facturacion.tsx` — insertar `<DateRangeFilter>` arriba.
7. `CHANGELOG.md` + `src/constants/appVersion.ts` — bump a `12.0.0-rc.15` con entrada describiendo el rediseño UX.

## Fuera de alcance

- No toco la lógica de filtros (`isInRange`, `useFacturacionDateRange`).
- No cambio columnas de tablas, mutations, RPCs ni esquemas.
- No modifico el Dialog de detalle del Hueco.
- No toco las páginas del Portal Cliente.
