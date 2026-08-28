# Auditoría de lógica de negocio — hallazgos y plan de remediación

Auditoría de tres dominios (financiero/facturación, CxP–costeo–embarques, CRM–cotizaciones–comisiones) leyendo el código real y consultando las funciones vigentes en la base. Abajo van sólo hallazgos verificados, ordenados por impacto en dinero.

## Hallazgos críticos (afectan dinero)

### 1. Comisiones "Por recuperar" nunca se recuperan
`generar_liquidacion_comision` (verificado en la base) sólo toma filas con `estado = 'Devengada'`. Cuando una factura ya cobrada se cancela o se le aplica nota de crédito, la comisión ya pagada pasa a `Por recuperar` y queda huérfana: no se descuenta de ninguna liquidación futura ni aparece en el KPI de pendientes (`src/features/comisiones/services/devengadas.ts:149-163`).

Analogía: es como una tarjeta de regalo que ya se usó y luego se devolvió el producto — el dinero salió y nadie lo pide de vuelta.

Arreglo: en la liquidación, restar del total el saldo `Por recuperar` del mismo vendedor (con piso en cero y arrastre del remanente al siguiente periodo), marcar esas filas como recuperadas y mostrar el saldo en el KPI.

### 2. El tope de sobrecosto en CxP es por factura, no por concepto
`_cxp_validar_aprobacion` (verificado) compara la suma vinculada **de esa factura** contra lo comprometido. Dos facturas distintas pueden vincular cada una el 100% del mismo `concepto_costo` y ambas aprobarse: doble costo y doble pago. Además la comparación suma `pfc.monto` contra `cc.monto` **sin convertir moneda**, así que un costo en USD contra factura en MXN dispara falsos sobrecostos (o los oculta).

Arreglo: calcular lo comprometido y lo facturado por `concepto_costo_id` incluyendo el resto de facturas vivas del mismo concepto, y normalizar ambos lados a MXN con el T/C DOF ya usado en el resto del ERP antes de comparar.

### 3. Reconciliación / P&L suma monedas distintas y las etiqueta como USD
`construirResumen` (`src/lib/domain/versionadoCotizacion.ts:105-112`) suma cotizado/refrescado/real sobre filas agrupadas por `concepto|moneda`, es decir mezcla USD, MXN y EUR. La UI (`ResumenReconciliacion.tsx:18-26`) rotula el resultado como USD siempre. En un marítimo típico (flete USD + maniobras MXN) el indicador de desviación queda falseado.

Arreglo: normalizar a MXN con el T/C del embarque/DOF antes de sumar y mostrar la moneda real; usar la variante por moneda que ya existe (`calcularResumenPorMoneda`).

## Hallazgos medios

### 4. Saldo de factura calculado sin el estado
`DialogRegistrarPago.tsx:58-61` y `FacturaPagosSection.tsx:49-53` llaman `calcularSaldoFactura` sin el 4º argumento `estado`, perdiendo la regla que fuerza saldo 0 en `Pagada/Cancelada/Sustituida/Borrador`. Reaparece el "adeudo fantasma" en facturas legacy y se precarga un monto que la base rechaza.

Arreglo: pasar el estado en ambos call-sites (el segundo ya lo recibe como prop).

### 5. Conversión que colapsa a 0 cuando falta T/C
`sumarConceptosEnUsd` (`.../proyeccionFacturacion/conversion.ts:20-34`) devuelve 0 para todo el conjunto si el T/C es inválido, en vez de excluir sólo las filas sin T/C y avisar, como sí hace el canon `convertir.ts`.

Arreglo: adoptar el patrón del canon (excluir y reportar `sinTipoCambio`).

### 6. KPI de comisiones usa el mes de hoy, no el periodo filtrado
`devengadas.ts:150-154` compara contra `ymMx()` mientras la lista ya viene filtrada por `filtros.periodo`; al consultar un mes pasado el KPI da 0.

Arreglo: usar el periodo del filtro como referencia.

### 7. Vigencia de cotización sin validación cruzada
`crear.ts:37-44`: si el usuario captura `validez_propuesta`, se guarda tal cual sin verificar que sea futura ni coherente con `vigencia_dias`.

Arreglo: validar que la fecha sea >= hoy y avisar cuando difiera de los días capturados.

### 8. Riesgos a confirmar contigo (no los toco sin tu respuesta)
- **Días de demora**: el cálculo usa `devolución - descarga` sin sumar 1. Si la naviera cuenta el día de descarga como día 1, se subfactura un día por contenedor.
- **T/C de nota de crédito en cartera**: `cartera_pendiente` convierte la NC con el T/C de emisión de la factura, no con el de la fecha de la NC.

## Detalles técnicos
- Cambios en base: nueva migración que reescribe `generar_liquidacion_comision` (descuento de `Por recuperar` + estado terminal) y `_cxp_validar_aprobacion` (tope por concepto y normalización a MXN).
- Frontend: correcciones puntuales en los archivos citados, más tests unitarios por cada hallazgo (saldo con estado, resumen multi-moneda, KPI por periodo, liquidación con saldo por recuperar).
- Se respeta el canon existente (`saldoFactura.ts`, `convertir.ts`, `tcPar.ts`); no se duplican fórmulas.
- `APP_VERSION` + `CHANGELOG.md` se actualizan al cerrar cada ola.

## Orden propuesto
1. Ola A (dinero): hallazgos 1, 2, 3.
2. Ola B (consistencia): hallazgos 4, 5, 6, 7.
3. Ola C: decisiones de negocio del punto 8, una vez que confirmes convenciones.
