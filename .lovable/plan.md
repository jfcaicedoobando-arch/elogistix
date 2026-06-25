# Columna "Liquidación" con 3 estados

## Qué cambia (visible para el usuario)

En `/embarques/:id?tab=costos`, en la tabla **Costos directos del embarque**, la columna **Liquidación** dejará de mostrar sólo "Pendiente / Pagado" y mostrará 3 estados con colores distintos:

| Estado mostrado | Cuándo aplica | Color sugerido |
|---|---|---|
| **Pendiente de cargar** | El costo aún no tiene factura de proveedor vinculada | Gris / outline |
| **Pendiente de pago** | Ya existe una factura de proveedor vinculada pero el costo sigue marcado como no pagado | Amarillo / warning |
| **Pagado** | `estado_liquidacion = 'Pagado'` | Verde / success |

No se cambia el modelo de datos (`conceptos_costo.estado_liquidacion` sigue siendo `Pendiente` / `Pagado`); el tercer estado se **deriva** en lectura a partir del vínculo con `proveedor_facturas_conceptos`.

## Cómo se decide cada estado

1. Si `estado_liquidacion = 'Pagado'` → **Pagado**.
2. Si existe al menos un renglón en `proveedor_facturas_conceptos` cuyo `concepto_costo_id` apunte al costo → **Pendiente de pago**.
3. En otro caso → **Pendiente de cargar**.

## Detalles técnicos

- **Servicio nuevo / extender query existente**: en `src/features/embarques/services/queries/conceptos.ts` (o un hook adicional consumido por `useEmbarqueDetalleData`) traer el `Set<string>` de `concepto_costo_id` que ya tienen factura de proveedor vinculada para el embarque actual. Una sola consulta:
  ```ts
  supabase
    .from('proveedor_facturas_conceptos')
    .select('concepto_costo_id, conceptos_costo!inner(embarque_id)')
    .eq('conceptos_costo.embarque_id', embarqueId)
  ```
- **Helper de UI**: nuevo `getEstadoLiquidacionDerivado(concepto, conFacturaSet)` en `src/features/embarques/utils/` que devuelve `'Pagado' | 'Pendiente de pago' | 'Pendiente de cargar'`.
- **Render**: en `src/features/embarques/components/TabCostos.tsx` la columna `liq` usa el helper y un `Badge` con clase según estado (no usar `getEstadoColor` genérico; mapear local para los 3 valores nuevos).
- **Filtro del checklist** (`ConceptosCostoCard.tsx`): el filtro actual `cxp / costo-no-liquidado` excluye los `Pagado`; mantener ese comportamiento. Adicionalmente, el filtro `costo-sin-factura` ya existe como clave en `FOCUS_LABEL` pero no filtra — aprovechar para que filtre por estado derivado **Pendiente de cargar**.
- **Tipo prop**: `TabCostos` y `ConceptosCostoCard` reciben el `Set<string>` de costos con factura (`costosConFactura`) y lo pasan al builder de columnas y al filtro.
- **Bump versión** + `CHANGELOG.md`.

## Fuera de alcance

- No se cambia el esquema de BD ni los valores almacenados.
- No se modifica la lógica de marcado de pago ni la conciliación con facturas.
- No se tocan otros listados (CXP, dashboards) — sólo la tabla de costos del detalle de embarque.
