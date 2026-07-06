
# Conciliación factura ↔ embarque a nivel de partidas (renglones)

Hoy el panel de `/compras/conciliacion` muestra los `conceptos_costo` de un embarque con montos cotizado / real y los folios vinculados como badges. Falta la vista a **nivel de partida** (`proveedor_facturas_conceptos`), un **estatus por renglón** consistente y **totales rodados** por embarque y por moneda.

## Modelo mental

```text
Embarque
 ├─ concepto_costo #1 (cotizado)         ← "renglón cotizado"
 │    ├─ pfc partida A (Fac F-001, $500)  ← "renglón real"
 │    └─ pfc partida B (Fac F-002, $400)
 └─ concepto_costo #2 (cotizado)
      └─ (sin partidas)
```

## Estatus por renglón

- **Renglón cotizado (`concepto_costo`)**:
  - `Sin match` — no tiene ninguna partida PFC vinculada.
  - `Parcial` — `real < cotizado * 0.99`.
  - `Conciliado` — `|real − cotizado| ≤ 1%` del cotizado.
  - `Excedente` — `real > cotizado * 1.01` (nos pasamos).
- **Renglón real (`proveedor_facturas_conceptos`)**:
  - `Vinculado` — tiene `concepto_costo_id` y ese concepto existe / mismo embarque / misma moneda.
  - `Huérfano` — sin `concepto_costo_id`, o cruza embarques / moneda distinta.

Los umbrales (1%) reusan el criterio ya presente (`vincularFacturaAConceptos` usa 99% para auto-liquidar).

## Alcance funcional

1. Extender `ConciliacionDetalleSheet` (`src/features/compras/routes/_sections/ConciliacionDetalleSheet.tsx`) para que cada renglón cotizado se pueda **expandir** y mostrar sus partidas reales debajo (una sub-tabla), no sólo los folios como badges.
2. Reemplazar la columna "Estado" (hoy `estado_liquidacion` crudo) por el **estatus de conciliación por renglón** (Sin match / Parcial / Conciliado / Excedente) con color semántico.
3. Añadir un **bloque de totales** al pie del sheet: Cotizado, Real, Diferencia, % desviación, # renglones por estatus (Sin match / Parcial / Conciliado / Excedente) y # partidas huérfanas si aplica. Segregar por moneda cuando el embarque mezcle MXN + USD.
4. Añadir columna "Huérfanas" en el KPI del panel: partidas PFC del embarque cuyo `concepto_costo_id` es NULL o apunta a otro embarque (se detectan comparando el embarque de la factura vs el del concepto).
5. Los datos vienen del servicio existente `fetchReconciliacionEmbarque`; se **enriquece** para traer también `descripcion` y `fecha_emision` de la factura por partida (hoy sólo trae `folio_proveedor`).

## Detalles técnicos

- **`src/features/embarques/services/reconciliacionCostos.ts`**
  - Extender `FacturaVinculada` con `descripcion: string | null` y `fecha_emision: string | null` (ya viven en `proveedor_facturas`/`proveedor_facturas_conceptos`).
  - Ajustar el `select` del embed `proveedor_facturas(id, folio_proveedor, deleted_at, fecha_emision)` y traer `descripcion` de la propia PFC.
  - Nueva función pura `clasificarRenglon(cotizado, real, tieneFacturas): "sin_match" | "parcial" | "conciliado" | "excedente"` con umbral ±1% (constante exportada `TOLERANCIA_CONCILIACION = 0.01`).
  - Añadir campo `estatus_renglon` en `FilaReconciliacion` calculado con la función anterior. La función es pura y testeable.
  - Nueva función pura `calcularResumenPorEstatus(filas)` que devuelve `{ sin_match, parcial, conciliado, excedente }` (conteos).
  - Nueva query `fetchPartidasHuerfanas(embarqueId)`: `proveedor_facturas_conceptos` cuyo `proveedor_factura_id` apunta a factura de este embarque, pero `concepto_costo_id` es NULL o su `conceptos_costo.embarque_id` es distinto. Devuelve el conteo (para KPI) — sin edición.
- **`ConciliacionDetalleSheet.tsx`**
  - Cambiar la columna "Facturas" por un ícono de expandir (chevron) — al hacer click se muestra debajo la sub-tabla de partidas: `folio · fecha · descripción · monto · % del cotizado`.
  - Cambiar la columna "Estado" por `estatus_renglon` con badges de color: destructive (Sin match / Excedente), warning (Parcial), success (Conciliado).
  - Añadir fila de **totales** en la parte inferior de la tabla (fuera del `DataTable`, en un `div` con grid), separando por moneda si `filas` mezcla monedas.
  - Añadir tarjeta compacta con el desglose por estatus (4 números coloreados) al lado del resumen económico existente.
- **Cambios de datos**: ninguno en BD; sin migraciones. Toda la clasificación es cliente/derivada.
- **Tests** (unitarios, sin Supabase):
  - `clasificarRenglon`: casos borde 0 cotizado, negativos, umbral inferior/superior.
  - `calcularResumenPorEstatus`: mezcla de filas.
  - `buildFilasReconciliacion`: verificar que `estatus_renglon` se popula correctamente con los nuevos casos.
- **Versionado**: bump `APP_VERSION` a `13.185.0` + entrada en `CHANGELOG.md`.

## Fuera de alcance

- Editar/mover partidas entre `conceptos_costo` desde el panel (drag & drop). Sólo lectura + navegación a `/compras/por-aprobar` para corregir.
- Split de partidas (una partida cubre dos conceptos_costo con proporciones). Sigue siendo 1 PFC → 1 concepto_costo.
- Cambios en el flujo de auto-liquidación (`vincularFacturaAConceptos`): mantiene su umbral de 99% actual.
- Persistir el estatus del renglón en BD: se deriva en runtime.

## Diagrama de UI

```text
┌──────────────── Sheet /compras/conciliacion ────────────────┐
│ Expediente · Cliente · [Abrir embarque]                     │
│ ┌─Resumen────────┐  ┌─Estatus renglones─────────────────┐   │
│ │ Cot / Real / Δ │  │ ●Sin match 2  ●Parcial 1 ●OK 4    │   │
│ │ %              │  │ ●Excedente 1  Huérfanas 0         │   │
│ └────────────────┘  └───────────────────────────────────┘   │
│ Concepto     Cot    Real   Δ     %     Estatus              │
│ ▸ Flete      1,000  1,000  0    0%    ● Conciliado          │
│ ▾ Maniobras  500    650   +150 +30%   ● Excedente           │
│      F-001 · 12-may · Maniobras origen  ·  400              │
│      F-002 · 20-may · Maniobras destino ·  250              │
│ ▸ Custodia   300      0  -300 -100%   ● Sin match           │
│ ────────────────────────────────────────────                │
│ TOTAL MXN    1,800  1,650  -150 -8.3%                       │
└─────────────────────────────────────────────────────────────┘
```
