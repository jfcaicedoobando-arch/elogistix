
# Costos directos del embarque — narrar el ajuste

## Problema

En el embarque 302, "Cargos en destino" se cotizó en **$191.80** y el proveedor facturó **$155.00** (ajuste a la baja, ahorro de $36.80). Hoy la card lo muestra correctamente pero de forma muy silenciosa: una columna Δ en verde con `-$36.80` y un `-19.2%` diminuto debajo. El usuario tiene que:

1. Comparar mentalmente dos números.
2. Recordar que verde = a favor y rojo = en contra.
3. Deducir que hubo un "ajuste" del proveedor (la palabra no aparece).

Queremos que el ERP **cuente la historia** en vez de que el usuario la reconstruya.

## Cambios propuestos (solo UI, sin tocar lógica de reconciliación)

### 1. Resumen superior de la card — 3 tiles

Antes del listado por proveedor, agregar un `ResumenAjusteBar` con 3 tiles por moneda:

```text
┌────────────────┬────────────────┬─────────────────────────┐
│ Cotizado       │ Facturado      │ Ajuste neto             │
│ MXN 4,280.50   │ MXN 4,243.70   │ ▼ Ahorro  MXN 36.80     │
└────────────────┴────────────────┴─────────────────────────┘
```

- Tile "Ajuste neto" cambia icono/color: `▼ Ahorro` (success), `▲ Sobrecosto` (destructive), `= Sin ajuste` (muted).
- Un solo bloque por moneda (MXN / USD apilados).

### 2. Columna "Ajuste" reemplaza a "Δ"

Renombrar la columna y sustituir el número seco por un **chip narrativo**:

| Cotizado | Facturado | Ajuste |
|---|---|---|
| 191.80 | 155.00 | 🟢 `▼ Ahorro 36.80 · 19%` |
| 500.00 | 620.00 | 🔴 `▲ Sobrecosto 120.00 · 24%` |
| 300.00 | 300.00 | ⚪ `= Sin ajuste` |
| 400.00 | — | ⚫ `Sin factura` |

- Chip con `ToneBadge` (mismo lenguaje visual que unificamos en CxP).
- Tooltip en el chip: *"El proveedor facturó $36.80 menos de lo cotizado (–19%)."* / *"El proveedor facturó $120.00 más de lo cotizado (+24%)."*
- Ya no se necesita colorear la celda "Facturado".

### 3. Header del grupo por proveedor

Reemplazar el resumen actual `MXN 4,280.50 → 4,243.70 (-36.80)` por:

```text
DHL Global Forwarding  [4 conceptos]           ▼ Ahorro MXN 36.80 · 3 con ajuste, 1 sin factura
```

- Frase corta con misma paleta (▼/▲/=) y contador de renglones con ajuste vs sin factura.
- Suma por moneda se conserva en tooltip del header.

### 4. Orden de filas dentro del grupo

Ordenar por **|desviación| desc**, luego "sin factura", luego "conciliado exacto". Así los ajustes relevantes quedan arriba y el usuario no los busca.

### 5. Micro-copy y consistencia

- "Δ" → "Ajuste" en encabezado y en cualquier tooltip.
- Definir un helper `describirAjuste(cotizado, facturado, moneda)` → `{ tono, icono, titulo, detalle }` reutilizable por tile, chip y header. Fuente única de verdad para no divergir.

## Archivos afectados

- `src/features/embarques/components/costos/ConceptosCostoCard.tsx` — reemplaza el bloque "Totales" del pie por `ResumenAjusteBar` arriba de los grupos.
- `src/features/embarques/components/costos/GrupoCostosProveedor.tsx` — nuevo header narrativo, orden de filas, columna "Ajuste" con chip.
- `src/features/embarques/components/costos/grupoCostosProveedorHelpers.ts` — agregar `describirAjuste` y `ordenarFilasPorAjuste`.
- `src/features/embarques/components/costos/ResumenAjusteBar.tsx` **(nuevo, ~60 líneas)** — 3 tiles por moneda.
- `src/features/embarques/components/costos/AjusteChip.tsx` **(nuevo, ~30 líneas)** — chip narrativo con tooltip, basado en `ToneBadge` de CxP.

## Fuera de alcance

- No se toca `reconciliacionCostos.ts` ni el cálculo de `diferencia`/`desviacion_pct`.
- No se cambia la tabla real vs cotizada del módulo `/compras/conciliacion` (es otro contexto).
- No se agrega botón para "aceptar ajuste" ni flujo de aprobación — solo comunicación visual.

## Bump

`APP_VERSION` → `13.307.20` + entrada en `CHANGELOG.md`.
