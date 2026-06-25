## Diagnóstico (analogía rápida)

El KPI del header **"Facturado mes"** y la tabla de **Emitidas** hoy hablan idiomas distintos, por eso no cuadran:

| | KPI header ("Facturado mes") | Tabla "Emitidas" |
|---|---|---|
| Periodo | Mes en curso (fijo) | Lo que diga el filtro de fechas (por defecto: **todo**) |
| Estados | Excluye **Cancelada** | Incluye **todos** (Borrador, Por timbrar, Cancelada, etc.) |
| Moneda | Todo convertido a **MXN** usando `tipo_cambio` de la factura | Cada factura en su moneda original (MXN y USD mezclados) |
| Visible | Un solo número | No hay totalizador al pie de la tabla |

Es como comparar "kilos del mes" contra "frutas sueltas del año" — siempre van a diferir.

## Qué voy a cambiar (solo UI / presentación)

1. **Footer totalizador en la tabla de Emitidas** (`TabFacturasEmitidas.tsx`)
   - Subtotal **MXN** (suma facturas en MXN)
   - Subtotal **USD** (suma facturas en USD)
   - **Equivalente MXN total** (USD convertido con `tipo_cambio` de cada factura + MXN)
   - Conteo de facturas y nota: *"Excluyendo canceladas"* (se restan en el cálculo del equivalente).
   - Usa los datos ya filtrados (`paginatedFacturas` cuando hay paginación local, o `filtered` completo — usaremos `filtered` para que el total sea de TODAS las páginas, no sólo la visible).

2. **Tooltip explicativo en el KPI "Facturado mes"** (`DashboardEjecutivoFacturacion.tsx`)
   - Aclarar: *"Facturas emitidas del mes en curso, convertidas a MXN con el tipo de cambio de cada factura. Excluye canceladas."*

3. **Botón "Filtrar por mes en curso"** en el `DateRangeFilter` del módulo (atajo de 1 click), para que el usuario pueda alinear visualmente la tabla con el KPI cuando quiera verificar.

4. Exponer `filtered` (no sólo `paginatedFacturas`) desde el controller para alimentar el footer.

## Qué NO voy a cambiar

- Lógica de negocio del KPI (`fetchDashboardEjecutivoFacturacion`) — su cálculo es correcto.
- Lógica de filtros del controller — sólo agrego el dato `filtered` ya existente al return.
- Migraciones, RPCs, RLS.

## Versionado

Bump a `13.135.71` + entrada en `CHANGELOG.md`.

## Detalle técnico

- `useFacturacionPageController` → agregar `filtered` al return.
- `Facturacion.tsx` → pasar `filtered` (renombrado a `facturasFiltradas`) a `TabFacturasEmitidas`.
- `TabFacturasEmitidas` → nuevo subcomponente `FacturasEmitidasFooter` con los 3 totales + `formatCurrency`.
- Helper local `sumarFacturasPorMoneda(facturas)` con tests unitarios para mantener el coverage ≥38%.
- `DateRangeFilter` → botón "Mes en curso" (si no existe ya).

¿Procedo?