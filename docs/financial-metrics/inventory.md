# Inventario verificable para métricas financieras

Fecha: 2026-10-13. Repositorio: jfcaicedoobando-arch/elogistix. Base solicitada y verificada: a6d72c6585e3b72992f65f3f5d12975e90104f5b, árbol del commit 4efb6615bc69d6e06b2b1d8bff6d07958300a01b.

## Alcance y resultado

Esto es un inventario de las fuentes disponibles en el código y el esquema versionado. No se consultó una base de datos, no se verificó qué filas existen en Chino Cochino, no se dio por desplegada ninguna migración y no se certificó un histórico real. La existencia de una columna no demuestra su completitud ni su significado contable para cada documento.

Se verificaron 3.181 de 3.184 archivos financieros locales seleccionados contra sus Git blobs del árbol solicitado. Se copiaron sólo coincidencias. Las tres discrepancias originales son una prueba EUR, una migración de permisos globales ausente y baseline.sql; no se usó ese baseline local para atribuir una definición al commit. Además se verificaron los tres helpers financieros y package.json; AGENTS.md se recuperó directamente del commit. La nueva regla de catálogos de AGENTS.md no afecta las fórmulas. El inventario preciso de columnas y líneas está en evidence/schema-field-inventory.json.

## 1. CxC y ventas a crédito

Fuente principal: [types.ts, facturas L6501](https://github.com/jfcaicedoobando-arch/elogistix/blob/a6d72c6585e3b72992f65f3f5d12975e90104f5b/src/integrations/supabase/types.ts#L6501).

Disponible en el contrato versionado:

- facturas: organization_id, moneda, subtotal, iva, ret_iva, ret_isr, total, tipo_cambio, fecha_emision, fecha_vencimiento, dias_credito, metodo_pago, forma_pago, estado, timbrado_en, cancelado_en, deleted_at, created_at, updated_at, snapshot_emision, sustituciones.
- conceptos_factura: cantidad, precio_unitario, tipo_iva, tasa_iva_aplicada, tasas/montos de retenciones, total, embarque_id. Hay estructura para tasas distintas; dividir por 1,16 sería incorrecto.
- pagos_factura: fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, ret_iva, ret_isr, cuenta_bancaria_id, lote_id, borrado y estados/fechas REP. El dinero del banco y el importe aplicado al documento no son intercambiables.
- factura_notas_credito: factura_id, fecha_emision, monto, moneda, tipo_cambio, conceptos JSON, estado, timbrado/cancelado/borrado. El helper baseNotaCreditoSinImpuestos obtiene base desde conceptos y rechaza desgloses desconocidos; no deduce IVA de un bruto.
- cobranza_seguimiento: factura_id, fecha_promesa, monto_promesa, fecha, tipo, comentario, created_at, updated_at. Es evidencia potencial de cobro previsto; no se encontró consumo de fecha_promesa/monto_promesa en src fuera de los tipos del checkout revisado. No se verificó que haya datos ni una política para elegir entre promesas revisadas/vencidas.

Lo que NO queda demostrado:

- metodo_pago PPD/PUE es un dato fiscal, no una certificación automática de venta comercial a crédito. dias_credito también necesita significado y cobertura definidos. No hay un campo inequívoco de clasificación comercial histórica a crédito en la estructura revisada.
- No hay base neta residual explícita por aplicación de pago o ajuste. Monto aplicado, retenciones y desglose fiscal permiten investigar la asignación, pero no autorizan prorratear ciegamente pagos entre base e impuestos.
- No hay clasificación explícita por línea de principal/agente o desembolso por cuenta de tercero frente a ingreso propio/comisión. Nombres de conceptos/proveedores no son sustituto.

Lectura canónica actual: cobranza_listado/cobranza.ts produce saldo monetario vivo. Sus filtros actuales de estado/borrado no reconstruyen automáticamente qué estaba vigente en otro mes.

## 2. CxP y compras/servicios a crédito

Fuente: [types.ts, proveedor_facturas L8262](https://github.com/jfcaicedoobando-arch/elogistix/blob/a6d72c6585e3b72992f65f3f5d12975e90104f5b/src/integrations/supabase/types.ts#L8262).

Disponible:

- proveedor_facturas: subtotal, iva, ieps, retenciones, total, moneda, tipo_cambio_usd, fechas emisión/vencimiento/programada, dias_credito, categoría, estado de captura/aprobación/vigencia, aprobación/cancelación/borrado.
- proveedor_facturas_conceptos: monto, iva, ieps, cantidad, vínculo concepto_costo_id y factura. No atribuir automáticamente todo el total a un único embarque.
- pagos_proveedor: monto, monto_en_moneda_factura, moneda, fecha_pago, TC, cuenta/lote, es_ajuste y es_anticipo_aplicado. es_ajuste es no monetario; aplicar un anticipo no es una segunda salida bancaria.
- proveedor_notas_credito: factura, fecha, monto, subtotal nullable, moneda/TC, estado y borrado. baseNcProveedor rechaza subtotal ausente. Monto no equivale a base de compras.
- anticipos_proveedor / anticipos_aplicaciones: salida, devolución, saldo, aplicación y vínculo con pago/factura. Sirven para evitar contar anticipo y aplicación como dos pagos.
- fecha_programada_pago es independiente de fecha_vencimiento y puede servir al escenario de pago, nunca al aging contractual ni a la población del DPO.

Pendiente:

- Definición de compra/servicio a crédito, incluyendo ajustes/NC de periodos anteriores, activos/inversión, gastos propios y desembolsos por terceros. El totalCostos del EERR no es el contrato aprobado de compras/servicios a crédito.
- Calendario de liquidaciones con varios plazos por factura: una sola fecha_programada_pago no representa por sí sola un plan de parcialidades. Se necesita identidad y saldo por pago previsto si habrá más de uno.

## 3. Historia reconstruible: límites concretos

No se encontró un ledger financiero bitemporal completo ni una tabla de snapshots de saldos diarios/mensuales en el esquema revisado. auditoria_snapshots guarda conteos/score de hallazgos, no cartera ni caja.

Evidencia explícita: [historial CxP](https://github.com/jfcaicedoobando-arch/elogistix/blob/a6d72c6585e3b72992f65f3f5d12975e90104f5b/supabase/migrations/20261007023000_audit99_121_historial_ajustes_no_monetarios.sql) conserva captura y última aprobación con snapshot_historico_disponible=false; lee pagos y NC con deleted_at IS NULL. La aprobación registrada por RPC puede guardar total/moneda/TC, pero no todo el ledger ni la base fiscal y sus aplicaciones. El recorder admite fallos con WARNING. historial_factura está orientado a bitácora de actividad y limita la salida; no usarlo como extractor financiero exhaustivo.

Clasificación de factibilidad:

1. Saldo monetario vivo por documento: fuente canónica existente, sujeto a lectura completa y alcance autorizado.
2. Aging actual: viable con saldo al mismo corte y vencimiento contractual. Usar p_fecha pasada sobre saldo actual sólo cambia la clasificación; no crea una cartera histórica.
3. Importe original de facturas/NC: existe en fila actual, conceptos/snapshot/XML si están disponibles. Se debe verificar inmutabilidad, fecha efectiva y reemplazos; no extrapolar a todos los documentos.
4. Saldo histórico por documento: reconstruible sólo si se prueba saldo de apertura más todos los movimientos efectivos, NC, bajas, restauraciones, cancelaciones, sustituciones y correcciones hasta el corte. updated_at/created_at no bastan para recuperar valores sobreescritos. Filtrar a vivos hoy borra hechos que sí existían al corte; aplicar estados actuales al pasado también.
5. Promedio diario: requiere apertura verificada y movimientos completos por fecha efectiva, o un snapshot certificado de cada cierre diario. Faltar un día no autoriza interpolarlo silenciosamente.
6. Promedio apertura/cierre: viable si ambos extremos son verificables con idéntica población/base. Es aproximación etiquetada; no es permiso para sustituir extremos desconocidos con el saldo de hoy.
7. Tres meses: cada mes necesita su propia evidencia. No repetir el saldo actual tres veces. Meses desconocidos quedan N/D con causa.

Cierre contable existente: configuracion, categoria contabilidad, clave cierre_periodo_fecha; la RPC actualizar_cierre_periodo deja fechas anterior/nueva y razón de reapertura. _assert_periodo_abierto bloquea varias mutaciones financieras, pero permite campos derivados/estados y depende del despliegue y de la fecha de activación. Una fecha de cierre actual no demuestra cobertura histórica completa ni que nunca se reabrió el periodo.

## 4. Caja, conciliación y disponibilidad

Fuentes: [cuentas_bancarias L4919](https://github.com/jfcaicedoobando-arch/elogistix/blob/a6d72c6585e3b72992f65f3f5d12975e90104f5b/src/integrations/supabase/types.ts#L4919), [bbva_movimientos L504](https://github.com/jfcaicedoobando-arch/elogistix/blob/a6d72c6585e3b72992f65f3f5d12975e90104f5b/src/integrations/supabase/types.ts#L504).

Disponible:

- Cuenta con moneda, saldo_inicial, fecha_saldo_inicial, activa y borrado.
- Movimiento con fecha, cargo/abono, saldo informado nullable, origen, hash_dedupe, estado y fecha de conciliación, vínculos con pago cliente/proveedor, lotes, anticipos y traspasos.
- Traspaso con importes/monedas de ambas patas, comisión y fecha. Excluir las patas internas del burn consolidado no significa omitir su comisión real.
- estado_cuenta_bancario informa cobertura sin_cobertura/parcial/completa respecto de la fecha_saldo_inicial y rechaza atribuir saldo inicial futuro a un periodo anterior.

Lo que esa cobertura NO prueba: que se hayan importado todos los extractos; que el cierre coincida con el banco; que no existan movimientos faltantes, cuentas omitidas, efectivo físico o fondos restringidos; ni la disponibilidad económica de todo el saldo. Una ausencia de filas pendientes no es un certificado de conciliación.

El saldo usado hoy por resumen.ts suma apertura y movimientos vivos desde la fecha inicial. v_saldos_cuentas_bancarias no filtra sólo Conciliado ni recibe corte; no es directamente la caja conciliada/disponible pedida.

Falta un contrato verificable de cuenta incluida, cobertura del extracto, saldo al corte, partidas conciliatorias, efectivo en tránsito, restricciones y revisión. No se encontró un campo explícito de saldo restringido/disponible. No asumir que activa=true equivale a disponible o que cuenta inactiva tuvo saldo cero en meses anteriores.

Historia bancaria reconstruible condicionalmente desde fecha_saldo_inicial; antes de ella, N/D. El saldo derivado de movimientos puede calcularse si la población y apertura son completas. Debe distinguirse reconstrucción contable desde importaciones de conciliación bancaria certificada.

## 5. Forecast 13 semanas y duplicidades

El flujo actual usa vencimiento CxC, programación/vencimiento CxP y día 5 del mes siguiente para liquidación de comisión. El denominador de runway actual usa EERR. Ninguno satisface automáticamente el contrato nuevo.

Fuentes potenciales: promesas de cobro, programación CxP, liquidaciones, anticipos/reembolsos, impuestos/nómina y otros compromisos expresos. No se encontró un calendario financiero exhaustivo de todos estos conceptos. La estimación del día 5 de comisión no debe llamarse compromiso real sin evidencia.

Deduplicación necesaria:

- Un cobro/pago se cuenta una vez, aunque aparezca como aplicación de factura, componente de lote y movimiento bancario.
- Una NC reduce deuda; no es movimiento de caja.
- Ajuste no monetario no produce caja.
- Anticipo se cuenta al desembolso; su aplicación no vuelve a desembolsar; devolución se cuenta cuando ocurre.
- Traspaso entre cuentas propias tiene dos patas internas; su comisión es movimiento externo real. El tratamiento depende del conjunto de cuentas y política FX.
- Comisión/seguro/gasto con factura enlazada no reaparece como compromiso independiente. Donde no exista vínculo, no deduplicar por descripción ni por coincidencia de importe: marcar conflicto.
- Pronosticar sólo saldo residual; un cobro incluido en caja al corte no puede volver a aparecer como previsto.
- Vencido sin nueva fecha prevista permanece identificado como no programado. No moverlo a semana 1 ni omitirlo como si ya no existiera.

## 6. Verificación de datos que queda por hacer, en modo lectura

Para una organización de prueba expresamente seleccionada, el siguiente paso debe producir conteos/agregados de cobertura por mes/moneda, sin nuevas escrituras:

- Confirmar esquema desplegado, funciones/ACL y cierre contable actual/reaperturas.
- Facturas y compras: cantidad/base/total por estado, fecha y moneda; cobertura de términos de crédito y clasificación comercial; líneas sin desglose fiscal; NC sin base/linaje; conversiones inválidas.
- Aplicaciones: monedas, importes y fechas; bajas/restauraciones; ajustes, anticipos, pagos posteriores al corte y transiciones de estado. Conciliar apertura + altas − aplicaciones ± reversos con cierre por documento y moneda.
- Banco: cuentas seleccionadas, arranque de historia, intervalo de extractos, saldos de control, pendientes, vínculos a pagos/lotes/anticipos/traspasos y restricciones conocidas. MIN/MAX(fecha) no prueba ausencia de huecos.
- Forecast: cobertura y vigencia de promesas; pagos programados contra residuales; otros compromisos y duplicidades sin vínculo.

Este paquete no ejecuta esas consultas, no crea migraciones ni determina los resultados de esas verificaciones.
