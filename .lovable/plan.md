
## Objetivo

Que ningún reporte financiero/operativo sume ni cuente facturas **Cancelada** o **Sustituida**. El listado de Facturas y las vistas de detalle/historial siguen mostrándolas (con su badge) porque su función es dar trazabilidad, no reportar.

## Auditoría — estado actual

Recorrí las 3 rutas por donde entran las facturas a los reportes: RPCs de Postgres, servicios TypeScript y generadores/exportaciones.

### Ya filtran correctamente (no requieren cambio)

| Reporte | Fuente | Cómo excluye |
|---|---|---|
| Sidebar · "Facturas vencidas" | RPC `sidebar_alert_counts` | `estado = 'Vencida'` |
| Bandeja · Cartera pendiente | RPC `cartera_pendiente` | `estado IN (Emitida, Vencida, Parcialmente pagada)` |
| Dashboard operativo | RPC `dashboard_summary` | No lee `facturas`, usa `conceptos_venta` y `proveedor_facturas` |
| Reportes de rentabilidad por cliente | RPC `profit_por_cliente` / `reportes_resumen` | No lee `facturas`, usa `conceptos_venta/costo` |
| Dashboard ejecutivo de facturación (KPI facturado) | `dashboardEjecutivo.ts` | `estado IN ESTADOS_FACTURADO` (Emitida/Parcial/Vencida/Pagada) |
| Cobranza (aging) | `cobranza.ts` | `estado IN ESTADOS_ACTIVOS` (Emitida/Parcial/Vencida) |
| Estado de cuenta cliente | `estadoCuenta.ts` | `estado IN ESTADOS_ACTIVOS` |
| Bandejas (borradores, emitidas, pagos) | `bandejas.ts` | Filtros por estado vivo |
| Hueco de facturación | `huecoFacturacion/fetchSources.ts` | `FACTURA_ESTADOS_VIVOS_HUECO` |
| Presupuesto vs Real | `presupuesto/vsReal.ts` | `.neq('estado','Cancelada')` sobre `proveedor_facturas` (la tabla no tiene "Sustituida") |
| Perfil financiero cliente | `cliente/services/financials.ts` | `estado IN ('Emitida','Vencida')` |

### Con hueco confirmado (a corregir)

1. **EERR devengado** — `src/features/profit/services/estadoResultadosDevengado.ts:76`  
   Usa `.neq("estado", "Cancelada")` pero **no excluye `Sustituida`**. Una factura sustituida sigue sumando en el estado de resultados devengado hasta que se cancele su UUID original. Debe excluir ambas.

2. **Portal del cliente — listado y detalle de facturas** — `src/features/portal/services/queries.ts:129` y `:142`  
   `fetchPortalFacturas` y `fetchPortalFactura` **no filtran por estado**. El cliente ve la Cancelada y la Sustituida mezcladas con las vigentes en su listado. Debe ocultar Canceladas y Sustituidas del listado (no del detalle si se accede por URL directa, para que el badge sea informativo).

## Cambios propuestos

### 1. Constante compartida para "estados vivos"
Crear `src/features/facturacion/domain/estadosFactura.ts` con:
```ts
export const FACTURA_ESTADOS_VIVOS = [
  "Emitida", "Pagada", "Parcialmente pagada", "Vencida",
] as const;
```
y usarla desde EERR devengado, portal y (opcionalmente) unificar con `ESTADOS_FACTURADO`, `ESTADOS_ACTIVOS` y `FACTURA_ESTADOS_VIVOS_HUECO` en un segundo paso (dejar la unificación fuera de este scope para no tocar reportes que ya funcionan).

### 2. Fix EERR devengado
`estadoResultadosDevengado.ts:76` — reemplazar `.neq("estado", "Cancelada")` por `.in("estado", FACTURA_ESTADOS_VIVOS)`.

### 3. Fix Portal
`portal/services/queries.ts:129` — añadir `.in("estado", FACTURA_ESTADOS_VIVOS)` en `fetchPortalFacturas`. Dejar `fetchPortalFactura` (detalle) sin filtro para no romper enlaces directos, pero renderizar el badge de estado ya existente.

### 4. Tests
- Test unitario en `estadoResultadosDevengado.test.ts` que verifique que una factura `Sustituida` no aparece en el EERR.
- Test en `portal/queries` (o snapshot del filtro) que asegure que el `in("estado", …)` está presente.
- Test de regresión en `src/lib/__tests__/facturas-estados-reportes.test.ts` que escanee los servicios de reportes (`dashboardEjecutivo`, `cobranza`, `estadoCuenta`, `estadoResultadosDevengado`, `hueco…`, `portal/queries`, `financials`) y falle si alguno lee `from("facturas")` sin un filtro por estado vivo.

### 5. Fuera de scope explícito
- `masivas.ts` y `exports.ts` (layout contable): operan sobre IDs seleccionados por el usuario o exportaciones contables donde la Cancelada es información válida. No se tocan.
- `facturas_listado` RPC: es el listado maestro. Debe seguir mostrando Canceladas/Sustituidas.
- Historial de la factura: sigue mostrando ambas por diseño (trazabilidad).

## Detalles técnicos

```text
src/features/facturacion/domain/estadosFactura.ts        [NUEVO]
src/features/profit/services/estadoResultadosDevengado.ts [FIX línea 76]
src/features/portal/services/queries.ts                   [FIX línea 129]
src/features/profit/services/__tests__/…                  [TEST]
src/features/portal/services/__tests__/queries.test.ts    [TEST]
src/lib/__tests__/facturas-estados-reportes.test.ts       [TEST guardrail]
CHANGELOG.md + APP_VERSION → 13.301.62
```

Sin migraciones ni cambios de RLS. Solo cliente + tests.
