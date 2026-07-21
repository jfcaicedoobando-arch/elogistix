# Ajustes de costo en embarque desde factura de proveedor

## Problema

Hoy la utilidad del embarque se calcula sumando `conceptos_costo.monto` — los costos que se **devengaron** al cotizar/crear el embarque. Cuando llega la factura real del proveedor con un monto distinto (típicamente menor, por un descuento como el caso FP-000039: cotizado 19,150 vs facturado 18,639.60, delta −510.40 USD), la diferencia se guarda solamente en `proveedor_facturas_conceptos` como puente. **No toca `conceptos_costo`**, así que el embarque muestra el costo viejo y la utilidad queda subestimada por 510.40 USD.

## Modelo elegido

Cuando existe un delta entre lo devengado y lo facturado, se **agrega un renglón nuevo** en `conceptos_costo` del mismo embarque etiquetado como "Ajuste factura {folio}". Signo:

- Delta negativo (facturado < devengado) → renglón negativo → **utilidad sube**.
- Delta positivo (facturado > devengado) → renglón positivo → utilidad baja.

Se conserva el concepto original intacto (historial) y el ajuste queda auditable como fila propia.

## Cambios

### 1. Nuevo servicio `crearAjustesFacturaProveedor`
`src/features/cxp/services/crearAjustesFacturaProveedor.ts`

Recibe la factura recién guardada + la información de captura. Genera:

- **Por cada `vinculo` con `monto ≠ montoOriginal`**: inserta un `concepto_costo` en el mismo `embarque_id` con:
  - `monto = monto - montoOriginal` (firmado)
  - `origen = 'ajuste_factura_proveedor'`
  - `concepto = 'Ajuste factura {folio}: {concepto_original}'`
  - `proveedor_id`, `moneda`, `tasa_iva_aplicada` heredados del original
  - Además crea la fila puente en `proveedor_facturas_conceptos` para trazabilidad y para que el trigger `tg_pfc_recalc_liq` propague el estado de liquidación desde los pagos reales.

- **En flujo CFDI con `embarqueAdHoc`**: si el XML trae **múltiples líneas** (por ej. 19,150 + −510.40), crear un `concepto_costo` por cada línea (firmado), en vez de uno solo por el total como hoy hace `crearConceptoCostoYVincular`. Así los descuentos aparecen como filas negativas.

### 2. Wire en el submit
`src/features/cxp/hooks/useNuevaFacturaProveedorForm.sideEffects.ts`

Después de `vincularSafe`, llamar `crearAjustesFacturaProveedor` best-effort (toast.warning si falla, la factura ya quedó guardada). Extender `VincularSafeResult` con `ajustesCreados` para incluirlo en el toast de éxito ("2 ajustes de costo aplicados al embarque").

### 3. Reversibilidad
`src/features/cxp/services/cancelarFacturaProveedor.ts`

Al cancelar la factura, soft-delete de los `conceptos_costo` con `origen='ajuste_factura_proveedor'` referenciados por esta factura vía `proveedor_facturas_conceptos`. Sin esto, un descuento cancelado dejaría al embarque con una utilidad falsamente inflada.

### 4. UI — Distinguir el ajuste en el detalle del embarque
Tab de costos del embarque: agregar un badge "Ajuste" (`variant="secondary"`, muted) cuando `origen === 'ajuste_factura_proveedor'` para que el usuario entienda por qué hay un renglón negativo/positivo pequeño junto al concepto original.

### 5. Feedback en captura
`src/features/cxp/components/CuadreConceptosBar.tsx`

Cuando el estado es "cuadrado" y hay al menos un `vinculo` con delta ≠ 0, agregar una línea de ayuda: "Se aplicará un ajuste de {X} USD al embarque {expediente}". Preview del efecto en utilidad antes de guardar.

### 6. Tests
- `crearAjustesFacturaProveedor.test.ts`: delta positivo, negativo, cero (no crea), múltiples vínculos, CFDI multi-línea con embarqueAdHoc, cancelación revierte ajustes.
- Verificar que `estadoResultados.ts` incorpora naturalmente los ajustes (ya suma todos los `conceptos_costo` sin filtro por `origen`).

### 7. Versión + changelog
`APP_VERSION` → `13.303.97`. Entry en `CHANGELOG.md` con analogía y caso FP-000039 concreto.

## No hace falta

- Migración de esquema: `conceptos_costo.origen` ya es `text` libre, no enum.
- Cambio al motor de utilidad: `estado_resultados` ya suma todos los `conceptos_costo` no eliminados, así que ajustes con montos firmados se incorporan automáticamente.

## Detalles técnicos

**Fórmula final de utilidad del embarque**:
```
utilidad = Σ conceptos_venta.monto − Σ conceptos_costo.monto (deleted_at IS NULL)
```
Con los ajustes firmados, el segundo sumando se corrige solo. Ej. FP-000039:
```
Antes:  costos = 19,150.00 → utilidad = ingresos − 19,150.00
Después: costos = 19,150.00 + (−510.40) = 18,639.60
         utilidad = ingresos − 18,639.60  (+510.40 vs antes)
```

**Idempotencia**: si el usuario re-vincula (edición futura), el servicio debe detectar ajustes previos de la misma factura y actualizarlos en lugar de duplicar. Se identifican con `origen='ajuste_factura_proveedor'` + puente en `proveedor_facturas_conceptos` con la misma `proveedor_factura_id`.

**Multi-moneda**: el ajuste hereda la moneda del concepto original. Si la factura viene en otra moneda que el concepto (edge case), se preserva la del concepto y se documenta como limitación.
