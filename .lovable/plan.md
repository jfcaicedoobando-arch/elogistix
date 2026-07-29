## Estado verificado hoy

Ya aplicado (comprobado en código y base de datos):
- **C1** guard de rol/tenant en borrado de embarques.
- **C2** rol fiscal en las 11 edge functions `facturapi-*`.
- **C3a/C3b/C3c** — existen en la base las 5 funciones agregadoras (`cobranza_agregados`, `estado_cuenta_agregados`, `conciliacion_resumen`, `dashboard_facturacion_kpis`, `direccion_totales`) y la guarda anti-truncamiento.
- **C5** filtro de eliminados en las RPCs de listado + suite RLS en CI.
- Cobranza y Estado de cuenta ya leen sus tarjetas del servidor (v13.323.3).

Pendiente (verificado):
1. **Cableado UI restante de C3c**: `fetchConciliacionResumen` y `fetchDireccionTotales` existen pero **ningún componente las consume todavía** — Conciliación bancaria y el tablero de Dirección siguen sumando en el navegador.
2. **C4 · Totales de dinero server-side**: en la base **no existen** `recalc_factura_totales`, `cotizacion_totales_conceptos` ni `recalcular_subtotal_cotizacion`. Los totales de factura manual, cotización y CxP los sigue calculando el navegador.
3. **C6 · Canon único de conversión de moneda**: **no existe** `src/lib/financial/convertir.ts`; siguen vivas 6 implementaciones con políticas distintas cuando falta tipo de cambio (unas suman dólares como si fueran pesos).

## Plan propuesto (3 olas)

### Ola A — Cerrar C3c en la interfaz
- Conectar la tarjeta de resumen de Conciliación bancaria a `conciliacion_resumen`.
- Conectar los totales del tablero de Dirección a `direccion_totales`.
- Mismo criterio ya usado: si hay filtros que la función del servidor no cubre, se vuelve al cálculo local para que tabla y tarjetas siempre cuadren.
- Tests de los hooks nuevos.

### Ola B — C4 · Totales calculados en el servidor
Una migración con tres partes:
- **Facturas**: función canónica que re-deriva subtotal, IVA (respetando tasa por renglón y exentos), retenciones y total desde los conceptos; trigger anti-escritura directa y CHECK de consistencia con tolerancia de un centavo. No toca facturas ya timbradas.
- **Cotizaciones**: función que calcula totales por moneda desde el JSON de conceptos (subtotal neto, sin IVA, sin mezclar monedas), RPC para persistir y trigger que valida los renglones.
- **CxP**: trigger que impone `total = subtotal + IVA + IEPS − retenciones`, rechaza totales negativos y bloquea bajar el total por debajo de lo ya pagado/acreditado.
Después: regenerar tipos y ajustar los puntos del frontend que hoy persisten totales calculados en el cliente.

Nota: el documento incluye un relleno de datos históricos que **corrige cifras visibles** de registros viejos inconsistentes. Antes de aplicarlo se listan los registros afectados para que los revises.

### Ola C — C6 · Canon único de moneda
- Crear el módulo canónico con la regla explícita: **sin tipo de cambio confiable no se suma** (se reporta aparte, nunca se simula 1 a 1).
- Migrar los 6 sitios divergentes + el diálogo de registrar pago (que hoy deduce el tipo de cambio dividiendo montos).
- Marcar como obsoletas las funciones viejas y añadir guardas (ESLint + test de arquitectura) para que no nazca una séptima implementación.

## Detalles técnicos
- Migraciones nuevas con nombres generados por la plataforma; incluyen GRANTs y `search_path` fijo como exige la auditoría de migraciones.
- Tras C4: regenerar `types.ts` y correr `audit:rpc-columns`, suite RLS y `bun run test`.
- Se registra cada ola en `CHANGELOG.md` con bump de `APP_VERSION`.

## Orden sugerido
Ola A (rápida, cierra C3c) → Ola B (la de mayor riesgo, con revisión de datos antes del relleno) → Ola C.
