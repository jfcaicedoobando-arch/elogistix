# Aceptación y mocks

## Ejecutado en este paquete

Los fixtures son ficticios y no requieren red/DB. Cubren contrato puro, no existencia de datos reales, definición contable de cada documento, conciliación real ni comportamiento de UI.

- Días reales: febrero 28/29, abril 30, octubre 31; rechazo de fechas inválidas.
- Tres meses cerrados cruzando año; rechazo de mes corriente y falta de cierre.
- DSO/DPO 15 días con apertura 100.000/cierre 0 y actividad 100.000 en mes de 30 días.
- Diario 100.000 durante 20 días y cero durante 10: DSO 20, aun cuando cierre es cero.
- Toda cartera normalizada: 150.000/100.000×30 =45, sin filtro por vencimiento.
- Homogeneidad organización/moneda/periodo/snapshot/población/asignación/FX/reconocimiento; prueba de tipos de denominador DSO/DPO.
- N/D ante historia incompleta/duplicada, políticas faltantes, datos truncados, actividad no positiva o importes inválidos; cero sólo con cobertura completa.
- Aging: todas las fronteras, deudas antiguas/futuras/sin fecha, duplicados, overflow y corte del saldo distinto al corte pedido; programación no cambia aging.
- Forecast: 13×7 días exactos, día 91/día 92, cuotas parciales, límite de residual, duplicado económico, evento ya realizado, remanente sin programación, vencido sin nueva fecha, supuesto etiquetado y caja inicial sin conciliación.
- Runway: 50.000 de consumo neto en 30 días y caja 100.000 =60 días; con 31 días =62; caja no positiva, ausencia de burn, periodo inválido, duplicados, transferencias excluidas y comisión incluida por una política mock expresa.

No se ha ejecutado aún una normalización IVA/retenciones de documentos. El test de componentes netos ya normalizados sólo demuestra que el kernel no agrega un multiplicador fiscal. Sería engañoso afirmar que prueba el pipeline fiscal completo.

## Casos obligatorios para los siguientes adaptadores

1. IVA mixto. Documentos de base 100 con IVA 16, IVA 8 y exento; retenciones distintas. Cobro total/parcial y NC antes/después. El saldo neto debe salir del contrato de aplicación aprobado y cuadrar con su documento; nunca bruto/1,16. Repetir para IEPS/retenciones de proveedor y NC sin subtotal. Datos sin desglose → N/D con IDs afectados.
2. Crédito vs contado. PPD/PUE con distintos plazos y cambios documentados. No clasificar por etiqueta fiscal sin política. Probar documentos pagados al emitir, anticipos y recuperaciones. Denominador y numerador usan la misma selección económica.
3. Principal/agente. Servicio propio más desembolso reembolsable y comisión, cada uno ligado a obligación. Verificar que la comisión no se sustituye por la facturación bruta ni se borra caja real de terceros. Si falta clasificación, N/D del indicador comparable; forecast sigue caja bajo su política explícita.
4. Reconstrucción histórica. Factura antes del mes, pago parcial durante mes, pago después del mes, NC y cancelación posteriores, baja/restauración, refacturación y ajuste no monetario. Cierre de cada día/mes según effectiveDate, evitando usar estado actual retrospectivamente. Reapertura produce revisión de snapshot y conserva versión previa. Gap de eventos: N/D; no reconstituir con updated_at.
5. Promedio. Diario certificado completo y alternativa apertura/cierre con etiqueta. Promedio diario no disponible pero extremos sí: sólo fallback deliberado y etiquetado. Extremos desconocidos: N/D. Cambio de método entre meses visible.
6. Caja. Extracto completo vs hueco en importación; apertura posterior al periodo; cuenta inactiva con historia; cuenta restringida; movimientos no conciliados; pagos emitidos no debitados; efectivo físico; ausencia de cuenta. No afirmar conciliación por conteo cero de pendientes.
7. Identidad. Pago simple, pago lote con varias facturas, cobro lote, anticipo y aplicación, devolución, NC, ajuste, traspaso con comisión, seguro ligado a factura y comisión registrada también como CxP. Cada hecho monetario una vez; duplicados con distintos IDs son detectados por linaje del adaptador.
8. Forecast. Promesa actualizada, varias promesas obsoletas, monto_promesa menor al saldo, plan de cuotas, programación parcial, vencidos sin promesa, cobro ya liquidado después del snapshot, evento al día 91/día 92, déficit entre cierres semanales y orden intradía no conocido. Fallar cerrado si las fuentes cambian durante la lectura.
9. Runway. Utilidad contable con caja consumiéndose y pérdida contable con caja creciendo; financiación, inversión, fondos terceros y transferencias bajo la política aprobada; nada de EERR en input. Horizonte con 28/29/30/31 días y cero consumo. No usar forecast como si fuera flujo ya realizado.
10. FX. Tasas históricas válidas por moneda/fecha, NC en distinta moneda, pagos con importe aplicado explícito, tasa EUR faltante y consolidación no homogénea. Ningún subtotal parcial se publica como total completo.
11. Seguridad/volumen. Organización de prueba y roles autorizados; ninguna mezcla de tenants; RPCs/paginación completas con >1.000 y >5.000 filas; límites/errores explícitos; mismo snapshot bajo concurrencia; reintentos idempotentes; límites de enteros y redondeo auditado.
12. Integración. Layout móvil, accesibilidad, ayudas/cortes/causas N/D, exportación coherente, comparativo de tres meses, ausencia de influencia del selector de EERR sobre DSO/DPO, sin doble carga ni invalidaciones de caché incompletas. CI/build/typecheck/lint/guards de la rama final y pruebas de no regresión.

## Condición para habilitación productiva

No basta con que el kernel pase sus mocks. Requiere política aprobada, lectura real verificada, conciliación de datos, controles de alcance/completitud, revisión independiente y QA integrada. Ninguna de esas evidencias puede sustituirse con un flag complete=true fabricado por el cliente.
