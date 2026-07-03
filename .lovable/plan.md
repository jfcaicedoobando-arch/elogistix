## Objetivo

Alinear `/facturacion` (pestaña "Emitidas") al *design language* que ya usan `/embarques` y `/proformas` (v13.147.0):

- Barra de filtros unificada (Search + Estado + Cliente + Sheet "Filtros" con secundarios).
- Chips de filtros activos con X individual y "Limpiar todo".
- Rango de fechas dentro de la misma barra (hoy vive suelto en la esquina de tabs).
- Feedback `X de Y facturas`.
- Header estándar (`PageHeader` — ya está) y acciones consistentes.

Analogía: hoy la página de Facturas es como un tablero con perillas repartidas por todo el cuarto (búsqueda arriba, fechas en la barra de tabs, estado en la card). Vamos a juntar todas las perillas en el mismo panel, con las mismas etiquetas y la misma forma que las otras páginas.

## Alcance

Sólo UI/presentación de la pestaña **Emitidas** en `/facturacion`. No toco:
- La tab **Notas de crédito** (usa su propio componente).
- El `HuecoFacturacionCard`, KPIs, dashboard ejecutivo o dialogs (timbrar, pago, cancelar).
- Las columnas de la tabla ni permisos (`canEdit`, `canEmitirFactura`).
- Servicios / RPC / lógica de negocio.

## Cambios

### 1. Nuevo componente `FacturasFiltros.tsx` (`src/features/facturacion/components/`)
Espejo del patrón `ProformasFiltros.tsx`:
- Desktop: `[Search][Estado][Cliente][Filtros ▾]`.
- Mobile: `[Search][Filtros ▾]`.
- Sheet lateral con: Operador (opcional — si aporta), rango de fecha de emisión.
- Chips debajo con X individual + "Limpiar todo".
- Empaqueta `FacturasFiltrosCampos.tsx` y `FacturasFiltrosChips.tsx` para mantener componentes pequeños (Power of 10 ≤ 200 líneas).

### 2. Extender `useFacturacionPageController`
- Añadir `filterCliente` y filtrado por cliente (nombre) sobre `facturas`.
- Derivar la lista de `clientes` únicos (id + nombre) desde `facturas` para poblar el select.
- Mantener `filterEstado`, `search`, paginación tal cual.

### 3. Actualizar `TabFacturasEmitidas.tsx`
- Reemplazar el bloque `<Card>` de búsqueda/estado por `<FacturasFiltros />`.
- Mover exportaciones a un `DropdownMenu "Acciones"` compacto (CSV / Layout contable) al lado derecho de los filtros (mismo tono que otras páginas).
- Añadir subtítulo `X de Y facturas` sobre la tabla (como en `/proformas`).

### 4. Ajustar `Facturacion.tsx`
- Quitar el `DateRangeFilter` suelto en la barra de tabs (queda dentro del Sheet de filtros de la tab Emitidas).
- Dejar tabs con `TabTriggerInfo` intactos (ya son estilo homologado).
- El botón `Nueva factura manual` se mantiene en el `PageHeader`.

### 5. Versionado + changelog
- `src/constants/appVersion.ts` → `13.148.0` (feature UX).
- Entrada en `CHANGELOG.md`.

## Diseño visual (referencia)

```text
Facturación                                     [+ Nueva factura manual]
Emisión de CFDI, complemento de pagos y notas de crédito

[ KPIs ejecutivos ]  [ KPIs fiscales ]
[ Hueco de facturación ]

┌─ Emitidas · Notas de crédito ──────────────────────────────────────────┐
│                                                                        │
│ [🔍 Buscar…] [Estado ▾] [Cliente ▾]      [Filtros (2) ▾]   [Exportar ▾]│
│                                                                        │
│ Chips: [Estado: Emitida ✕] [Desde 01/01 ✕]              [Limpiar todo] │
│                                                                        │
│ 123 de 456 facturas                                                    │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ # Factura · Expediente · Proforma · Cliente · Monto · …            │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ [ Footer con totales ]                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

## Verificación

- Al filtrar por Estado, aparece chip removible y contador se actualiza.
- Rango de fechas del Sheet reemplaza al viejo `DateRangeFilter` sin perder funcionalidad (usa el mismo `useFacturacionDateRange`).
- Exportar CSV / Layout contable siguen respetando los filtros aplicados.
- `bun run lint` y `bun run test` deben pasar (agrego test unitario para filtro de cliente).