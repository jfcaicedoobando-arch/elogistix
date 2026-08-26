# Dictamen del parche `fixes_02_financial_validation.diff`

Revisé cada hallazgo contra el código actual. Resumen: **5 son bugs reales que vale la pena corregir**, 2 son mejoras cosméticas de bajo valor y **2 los descarto porque romperían funcionalidad existente**.

## Bugs reales — sí corregir

**B-09 — En pesos siempre se cobra IVA, aunque el concepto sea exento (el más grave)**
`calcularTotalesProforma` filtra los conceptos MXN y les aplica IVA ignorando por completo `aplica_iva`. Un flete internacional exento o un concepto al 0% en pesos termina con 16% de más en la proforma. Analogía: la caja registradora tiene el botón de "exento" conectado a nada cuando cobras en pesos. Se corrige haciendo que MXN respete la misma regla que USD: `tasa_iva_aplicada` de la fila, y si `aplica_iva` es falso, cero.

**B-03 — Documentos con fecha pasada se valúan con el tipo de cambio de hoy**
`DialogRegistrarPago`, `FacturaManualDatosFiscales` y `FacturaDatosFiscalesCard` llaman `useExchangeRates()` sin fecha, así que un pago del día 10 capturado el día 25 se convierte con el DOF del 25. El servicio (`fetchExchangeRates(fecha)`) y la edge ya aceptan fecha; sólo falta pasarla desde el hook y los tres componentes.

**B-08 — Nadie detecta cuando los totales guardados no cuadran con los conceptos**
Hoy la pantalla de proforma recalcula y muestra, pero si el registro persistido difiere no hay señal. El parche añade un detector que avisa en consola/Sentry ante desviaciones. Barato y sin riesgo.

**B-24 — Faltan validaciones y topes en tracking de embarques**
`fetchEventosEmbarque` lee una tabla append-only sin `limit` (crece sin tope) e `insertEventoEmbarque` no valida en el boundary: acepta tipo vacío y fechas con formato libre. También conviene la cota inferior de fecha en la nota de crédito (no puede fecharse antes de la factura) — la BD ya la valida, esto lo mueve a la UI para que el usuario no llegue al error.

**B-21 — Redondeo inconsistente con la base de datos en montos negativos**
`sumarEnMoneda` usa un atajo `Math.round(monto * 100)` que en negativos redondea distinto a Postgres (−2.505 → −2.50 en el front, −2.51 en la BD). Impacto en centavos, pero es exactamente el tipo de descuadre que dispara conciliaciones manuales. Se unifica con la primitiva `roundMoney` existente.

## Bajo valor — aplicar sólo por consistencia

**B-24 (parte CRM)** — proteger el `.or()` del filtro "mis actividades" ante emails con coma. Un email válido no puede contener comas, así que no es explotable; se aplica sólo porque exportar el helper cuesta nada.

**B-22 — tolerancia de medio centavo en "liquidada"** — el cambio de `saldo < 0.01` a `< 0.005` en realidad *endurece* el criterio y podría dejar facturas con residuo de 0.006 como no liquidadas. **No lo aplico**; el canon actual ya trata las facturas en estado "Pagada" como saldo cero.

## Descartados — romperían el sistema

**B-23 (`.strict()` en cotizaciones y embarques)** — hoy esos schemas usan `.passthrough()` a propósito: las mutaciones envían muchas más columnas de las listadas (detalle por modo FCL/LCL/aéreo, campos operativos). Con `.strict()` toda alta de embarque o cotización empezaría a fallar con "campo no permitido". Sí conservaré la parte sana del hallazgo: **topes numéricos** (monto máximo, cantidades enteras) sin cambiar `passthrough` por `strict`.

**B-23 (`organization_id` fuera del schema de cliente)** — el campo es legítimo en la importación multi-org; quitarlo del input y reinyectarlo en el servicio agrega complejidad sin cerrar ningún hueco (la BD ya aísla por organización con sus políticas).

## Detalle técnico

- `src/features/proformas/domain/proforma.ts`: unificar la resolución de IVA MXN/USD en un helper por concepto; añadir parámetro opcional de totales declarados para el detector B-08 y usarlo desde `ProformaDetalle.tsx`. Actualizar los tests que hoy fijan la regla "MXN siempre lleva IVA".
- `src/features/catalogos/hooks/useExchangeRates.ts`: parámetro `fecha?: string` incluido en la `queryKey`; consumidores puntuales (pago, factura manual, detalle fiscal) pasan la fecha del documento.
- `src/features/facturacion/hooks/useBanxicoTipoCambio.ts`: aceptar `fechaEmision`.
- `src/lib/financial/costosUSD.ts`: eliminar el fast path en centavos y redondear cada fila con `roundMoney`.
- `src/features/embarques/services/eventos.ts`: `limit` en la lectura y validación Zod (`eventoTrackingSchema` con fecha `AAAA-MM-DD`) en la escritura.
- `src/lib/search/ilike.ts`: exportar `quoteOrValue`; usarlo en `filtroResponsable` de CRM.
- `src/lib/validation/mutationSchemas.cotizacion.ts`: sólo topes de monto/cantidad, sin `.strict()`.
- Tests: ajustar `proforma.test.ts`, `proforma.extra.test.ts`, `proforma.flow.integration.test.ts` y `calcularTotalMxn.test.ts`; nuevo test del caso MXN exento.
- `CHANGELOG.md` + `APP_VERSION` → `13.748.0`.
