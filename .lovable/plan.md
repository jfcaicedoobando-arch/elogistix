# Facturación, pagos y conciliación: una sola fuente de verdad

## Qué encontró la auditoría

Hoy la misma cifra ("cuánto se cobró" y "cuánto falta") se calcula en varios lugares distintos, y cada pantalla puede estar leyendo un cálculo diferente. Eso es la raíz de los bugs recientes (factura 1015, ajustes fantasma, REPs cancelados).

**Saldo de factura: 5 cálculos paralelos**

| Dónde | Excluye pagos con REP cancelado |
|---|---|
| `saldo_factura` (base) | sí, pero devuelve 0 si el estado ya es "Pagada" |
| `saldo_factura_bruto` (base) | sí, sin el atajo del estado |
| `cartera_pendiente` (base, fórmula propia) | sí |
| `cobranza_listado` / `cobranza_agregados` (base) | **no** |
| Dashboard de Dirección (`saldoCartera.ts` + `loaders.ts`) | **no** (ni siquiera lee `estado_rep`) |
| `calcularSaldoFactura` (cliente) | sí |

Consecuencia medida: hay **21 pagos con REP cancelado**. En Cobranza y en el dashboard de Dirección esos pagos siguen contando como cobrados; en Portal, Estado de Cuenta y Cartera no. Dos pantallas dan cifras distintas de la misma factura.

**Lógica circular saldo ↔ estado**

`saldo_factura` devuelve 0 cuando el estado es "Pagada", y el estado se decide a partir del saldo. Por eso hubo que crear `saldo_factura_bruto` para poder sacar a la 1015 de "Pagada". El círculo sigue vivo en las otras copias del cálculo.

**Conversión de notas de crédito duplicada**

La misma cascada de tipo de cambio está copiada en `saldo_factura`, `cartera_pendiente` y `portal_factura_resumen_saldo`, mientras ya existe la función dedicada `nc_aplicadas_en_moneda_factura`.

**Conciliación bancaria: 9 rutas de escritura, 7 prefijos de dedupe**

- La reversa por REP cancelado sólo busca el movimiento por `pago_factura_id`; los cobros en lote se ligan por `pago_factura_lote_id`, así que un REP cancelado dentro de un lote **no reversa nada** (hoy hay 1 movimiento de cobro en lote y 1 de proveedor en lote: riesgo real pero pequeño).
- Dos rutas crean el movimiento espejo con INSERT directo desde el navegador (`cobroFacturaMovimiento.ts`, `pagoProveedorMovimiento.ts`), sin el candado `ON CONFLICT` que sí usa la ruta de proveedor en la base.
- `crearMovimientoBancarioCobro` se traga el error: el cobro se guarda pero el abono bancario puede no crearse nunca, sin avisar. Hay **138 pagos vigentes sin movimiento bancario ligado** (hay que clasificar cuántos son cobros en efectivo/legacy y cuántos son huecos reales).
- El único indicador de "movimiento del sistema vs. línea real del banco" es el prefijo del texto `hash_dedupe`, no una columna tipada.

## Propuesta: el deber ser

Un solo cálculo por concepto, en la base, y el cliente sólo lo consume.

1. **Un único saldo canónico.** `saldo_factura_bruto` pasa a ser la única fórmula: sin atajo por estado, excluyendo pagos anulados y notas de crédito aplicadas. `saldo_factura`, `cartera_pendiente`, `cobranza_listado`, `cobranza_agregados`, `cxc_aging_clientes` y `portal_factura_resumen_saldo` dejan de calcular y la llaman (o llaman una vista que la usa). Se le crea archivo canónico en `supabase/schema/facturacion/`.
2. **Se elimina el atajo "si Pagada entonces saldo 0"**, que es la causa de la circularidad. El estado deja de ser insumo del saldo: sólo su resultado.
3. **Un solo lugar decide el estado**: el trigger `recalcular_estado_factura`, ya protegido por `guard_estado_factura`. No cambia su rol, sólo su insumo queda unificado.
4. **Conversión de notas de crédito sólo por `nc_aplicadas_en_moneda_factura`**; se borran las tres copias.
5. **El cliente no reimplementa nada.** `calcularSaldoFactura` queda sólo para vistas que ya traen los renglones (con el mismo criterio, sin atajo por estado) y `saldoCartera.ts` del dashboard se sustituye por la RPC canónica. El select de Dirección incluye `estado_rep`.
6. **Un solo punto de escritura del movimiento espejo.** Las dos rutas que insertan desde el navegador pasan a una RPC `SECURITY DEFINER` con `ON CONFLICT`, igual que ya hace proveedores. El fallo deja de ser silencioso: si el abono no se puede crear, el usuario lo ve.
7. **La reversa por REP cancelado busca también por lote**, para que un cobro en lote anulado sí libere su movimiento bancario.
8. **Origen del movimiento explícito**: columna tipada (`sistema` / `estado_cuenta`) en lugar de adivinar por el prefijo del texto, con backfill desde los prefijos actuales.
9. **Un chequeo diario de consistencia** que liste facturas cuyo estado no coincide con su saldo canónico y cobros vigentes sin movimiento bancario, reusando la auditoría que ya existe en lugar de crear un módulo nuevo.

## Orden de trabajo propuesto

Por etapas, cada una entregable y verificable por separado:

- **Etapa 1 (corrige cifras visibles hoy).** Filtrar pagos anulados en `cobranza_listado`, `cobranza_agregados` y en el dashboard de Dirección. Es el hallazgo de mayor impacto y el más pequeño.
- **Etapa 2 (rompe el círculo).** Unificar todo sobre `saldo_factura_bruto`, quitar el atajo por estado, dejar una sola conversión de notas de crédito, recalcular los estados afectados.
- **Etapa 3 (conciliación).** Punto único de escritura del espejo, reversa por lote, columna de origen, fallo visible.
- **Etapa 4 (candado).** Chequeo diario de consistencia y pruebas focalizadas por etapa.

Nada de esto cambia importes, IVA, comprobantes fiscales, REPs, comisiones ni permisos: sólo unifica de dónde sale cada cifra.

## Detalle técnico

- Base: `saldo_factura_bruto` como única fórmula (archivo canónico nuevo); `saldo_factura` se convierte en envoltura delgada para no romper llamadores legacy; `cartera_pendiente`, `cobranza_listado`, `cobranza_agregados`, `cxc_aging_clientes`, `portal_factura_resumen_saldo` la consumen. Migración + espejo SQL en el mismo cambio, baseline regenerada, `db:postcheck`.
- Cliente: `src/lib/financial/saldoFactura.ts` conserva `esPagoAnulado`, elimina `ESTADOS_SIN_SALDO` del cálculo de saldo; `src/features/dashboard/direccion/services/saldoCartera.ts` y `loaders.ts` pasan a la RPC canónica; `src/features/facturacion/services/cobranza.ts` no cambia de contrato.
- Tesorería: nueva RPC `asegurar_movimiento_cobro_factura(pago_id)` con `ON CONFLICT (cuenta_bancaria_id, hash_dedupe)`; `cobroFacturaMovimiento.ts` y `pagoProveedorMovimiento.ts` la invocan y propagan el error; `reversar_movimiento_cobro_rep_cancelado` amplía la búsqueda a `pago_factura_lote_id`; columna `origen` en `bbva_movimientos` con backfill por prefijo de `hash_dedupe`.
- Validación local: typecheck, ESLint focalizado, pruebas de `financial`, facturación, cobranza, portal y tesorería, `audit:manifest`, `audit:schema-functions`, `db:postcheck`, build. CI, RLS y E2E completos quedan para GitHub Actions.
