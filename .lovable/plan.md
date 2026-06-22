## Problema

Hoy, al capturar una factura de proveedor (CxP), el bloque "Vincular a costos de embarque" sólo lista `conceptos_costo` que operaciones ya pre-cargó para ese proveedor. Si operaciones no los capturó, la sección **queda vacía** y la factura termina sin embarque asociado → se rompe la rentabilidad real vs cotizado.

## Solución: sugerencia inteligente de embarque + crear concepto al vuelo

Cambiamos `VincularEmbarqueSection` para que, cuando no haya `conceptos_costo` pendientes, **busque embarques candidatos** donde ese proveedor probablemente participe, y permita crear el `concepto_costo` al momento de capturar la factura.

### 1. Detección automática del embarque (en orden de prioridad)

Una RPC nueva `sugerir_embarques_para_proveedor(proveedor_id, organization_id, limit)` devuelve embarques activos (estado ≠ Cerrado/Cancelado) rankeados por:

1. **Match directo**: `embarques.agente`, `embarques.naviera`, `embarques.transportista`, `embarques.aerolinea` = nombre del proveedor (case-insensitive). Score 100.
2. **Tarifa vinculada**: el embarque usa una `costeo_tarifas` cuyo agente/naviera = proveedor. Score 80.
3. **Histórico**: en los últimos 90 días este proveedor facturó embarques del mismo cliente/ruta. Score 50.
4. **Recientes activos** del tenant como fallback. Score 10.

### 2. UI nueva en `VincularEmbarqueSection`

```text
┌─ Vincular a costos de embarque ──────────────────────────┐
│ ● Conceptos pendientes (caso actual, sin cambios)         │
│                                                            │
│ ── o ──                                                    │
│                                                            │
│ ○ Buscar embarque manualmente  [expediente / BL / cliente]│
│                                                            │
│ ★ Sugeridos para "DHL Global Forwarding":                 │
│   ┌──────────────────────────────────────────────────┐   │
│   │ MX-2026-0142 · Cliente ACME · ETA 25/06/2026     │   │
│   │ Match: agente directo               [Vincular]   │   │
│   ├──────────────────────────────────────────────────┤   │
│   │ MX-2026-0138 · Cliente XPTO · En tránsito        │   │
│   │ Match: tarifa vinculada             [Vincular]   │   │
│   └──────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

Al clic en "Vincular":
- Si el embarque YA tiene `conceptos_costo` pendientes de ese proveedor → se muestran y se preseleccionan con el monto de la factura distribuido proporcionalmente.
- Si NO los tiene → se ofrece **crear un concepto_costo nuevo** con: `concepto = línea CFDI` (o "Servicios proveedor"), `monto = total factura`, `proveedor_id`, `embarque_id`. Se inserta en `conceptos_costo` y se vincula automáticamente al guardar.

### 3. Bandeja "Facturas sin embarque" (visibilidad)

En `/cxp/por-pagar` agregar chip `Sin embarque` que filtra `proveedor_facturas` donde no existe ninguna fila en `proveedor_facturas_conceptos`. Permite re-abrir la factura y vincularla después.

## Archivos a tocar

- **Migración nueva**: RPC `sugerir_embarques_para_proveedor` (SECURITY DEFINER, scoped por `organization_id`).
- `src/features/cxp/services/sugerirEmbarques.ts` (nuevo) + test.
- `src/features/cxp/hooks/useSugerirEmbarques.ts` (nuevo).
- `src/features/cxp/components/VincularEmbarqueSection.tsx` — agregar sub-componente `SugerirEmbarqueBlock` (buscador + lista sugeridos).
- `src/features/cxp/services/conceptosCostoVinculables.ts` — agregar `crearConceptoCostoYVincular()`.
- `src/features/cxp/hooks/useNuevaFacturaProveedorForm.ts` — soportar estado `embarqueSeleccionadoAdHoc` y meterlo al submit.
- `src/features/bandejas/routes/CxpPorPagar.tsx` — chip filtro `Sin embarque`.
- Tests: aggregates, vinculables y RPC suggest.
- `CHANGELOG.md` + `APP_VERSION` → `13.99.2`.

## Fuera de alcance (lo dejamos para después)

- Fuzzy match por nombre cuando el RFC no coincide.
- Split automático multi-línea CFDI con IVA fino.
- Reglas por categoría (ej. siempre flete marítimo → naviera).
