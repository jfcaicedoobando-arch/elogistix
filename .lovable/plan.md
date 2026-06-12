## Diagnóstico

Buena noticia: el esquema ya está casi listo. No hace falta romper nada.

Hoy tienes 3 capas de costo conviviendo:

```text
cotizacion_costos        →  costo estimado (oferta comercial)
        ↓ (al ganar y crear embarque)
conceptos_costo          →  costo presupuestado del embarque (lo que YO esperaba pagar)
        ↑
proveedor_facturas       →  factura real del proveedor (lo que REALMENTE pagué)
   └ proveedor_facturas_conceptos.concepto_costo_id  ←  vínculo línea a línea (ya existe)
```

El campo `proveedor_facturas.embarque_id` y `proveedor_facturas_conceptos.concepto_costo_id` ya existen. Lo que falta es **cerrar el ciclo de uso**: forzar/sugerir el vínculo, exponer la comparación, y consumirla en EERR.

## Mejor práctica recomendada

Mantener la **separación devengado vs presupuestado**, que ya está bien pensada:

- `conceptos_costo` = costo **planeado/devengado** del embarque (lo que cotizamos, lo que se va provisionando).
- `proveedor_facturas` + `proveedor_facturas_conceptos` = costo **real facturado**.
- La conciliación es un *matching* entre ambos, no una sustitución.

Esto evita doble contabilización y respeta el principio de devengado que ya usa `estadoResultadosDevengado.ts`.

## Plan por fases

### Fase 1 — Cierre del vínculo (UX y datos)
1. En `DialogNuevaFacturaProveedor`: si el proveedor tiene embarques con costos pendientes de liquidar, mostrar selector de embarque y, al elegirlo, sugerir los `conceptos_costo` abiertos como líneas (pre-llena `proveedor_facturas_conceptos` con `concepto_costo_id` + monto sugerido).
2. Al guardar la factura, si todas sus líneas cubren el monto del `concepto_costo`, marcar automáticamente `estado_liquidacion = 'Liquidado'` y registrar `referencia_pago = folio_proveedor`.
3. Agregar columna "Factura proveedor" en la tabla de costos del embarque (link al `proveedor_factura_id` cuando exista).

### Fase 2 — Reporte "Cotizado vs Real" por embarque
1. Nueva vista SQL `embarque_costos_reconciliacion_v` que para cada embarque devuelva por concepto/proveedor:
   `cotizado` (de cotizacion_costos vía `cotizacion_id`), `presupuestado` (conceptos_costo), `real_facturado` (suma de proveedor_facturas_conceptos), `diferencia`, `% desviación`.
2. Nueva pestaña en detalle de embarque: **Conciliación de costos** (tabla + KPI de desviación global + badge verde/amarillo/rojo por línea).
3. Reporte mensual exportable: "Top 10 embarques con mayor desviación de costos".

### Fase 3 — Alimentación al EERR
1. `estadoResultadosDevengado.ts` ya usa `proveedor_facturas` para costos reales. Sólo agregar **drill-down por modo más confiable**: hoy hace fallback a "Marítimo" cuando no hay `embarque_id` — con el vínculo obligatorio de Fase 1 esto se vuelve preciso.
2. Nuevo KPI ejecutivo: **Margen Real vs Margen Presupuestado** (compara `conceptos_venta` − `conceptos_costo` contra `facturas` − `proveedor_facturas`).
3. Alerta automática en bitácora cuando un embarque cierre con desviación > X% (configurable en `configuracion_global`).

### Fase 4 — Automatización (opcional, futuro)
- Al subir CFDI XML del proveedor (`parse-cfdi-xml`), intentar auto-vincular al embarque por: RFC proveedor + monto + ventana de fechas ±15 días. Sugerir match con confianza %, no auto-aplicar.

## Detalles técnicos

- **Sin migración pesada en Fase 1**: el FK `embarque_id` y `concepto_costo_id` ya existen.
- **Migración mínima Fase 2**: una vista SQL + índice compuesto `(embarque_id, concepto_costo_id)` ya existente en `proveedor_facturas_conceptos`.
- **Multi-moneda**: usar `tipo_cambio_usd` del embarque (no de la factura) para que la comparación cotizado/real sea en la misma base, igual que hace `embarqueKpis.ts`.
- **RLS**: heredar por `organization_id` (mismo patrón ya usado).
- **Tests**: agregar a `services/cxp/__tests__/` casos de auto-liquidación al facturar y de cálculo de desviación.
- **Centralizar matemática** en `lib/financial/financialUtils.ts` (regla de memoria).

## Lo que NO recomiendo

- ❌ Crear una tabla nueva tipo `gastos_embarque` o duplicar montos en `embarques`. Rompe la fuente única de verdad y duplica el cálculo.
- ❌ Borrar `conceptos_costo` cuando llegue la factura real. Pierdes la trazabilidad cotizado→presupuestado→real.
- ❌ Hacer el vínculo obligatorio de golpe — primero suaviza con sugerencias (Fase 1), luego endurece con validación.

## Entregable de esta conversación

Si apruebas, arranco por **Fase 1** (cierre del vínculo + auto-liquidación). Es la que más valor entrega con menos riesgo y desbloquea las fases 2-3.
