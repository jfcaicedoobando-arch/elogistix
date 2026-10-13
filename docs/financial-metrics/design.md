# Diseño y despliegue por etapas

## Criterio de negocio recibido

DSO = CxC comercial promedio / ventas netas a crédito del mismo periodo × días reales. DPO = CxP comercial promedio / compras y servicios a crédito del mismo periodo × días reales. Toda la cartera comercial del alcance, sin ventana de próximos 30 días. Promedio diario si es verificable; apertura/cierre como aproximación etiquetada. Mes cerrado y tres meses comparables. Aging por vencimiento contractual, separado de programación. Forecast 13 semanas por cobros/pagos previstos desde caja conciliada. Runway sobre caja disponible y consumo neto efectivo. IVA/retenciones coherentes por documento; desembolsos de terceros separados de comisión propia. Ausencia de datos: N/D con causa.

## Criterios aprobados el 13 de octubre de 2026, 12:32 UTC

1. Separar crédito/contado y operaciones propias/de terceros con datos documentados. PPD, días de crédito o texto libre no constituyen clasificación comercial.
2. Netos e impuestos documentados, sin prorrateo fiscal automático. Componentes desconocidos quedan N/D.
3. Cálculo por moneda documental, sin consolidación cambiaria automática. Aplicaciones intermoneda necesitan linaje documental; una tasa actual no inventa su historia.
4. Runway con consumo neto operativo de tres meses completos cerrados. Se excluyen inversión, financiación, fondos de terceros y patas de transferencia interna; una comisión operativa documentada se conserva.
5. Caja disponible conciliada al corte, cuentas/fondos y restricciones explícitos. Cuenta activa, marca Conciliado y campo saldo no la certifican.

La aprobación fija políticas; no certifica los datos existentes. La integración inicial permanece N/D hasta contar con un lector/verificador real. El módulo puro de runway continúa siendo genérico; su wrapper aprobado exige una ventana observada exacta de tres meses calendario, cierre contable y caja conciliada al corte explícito aplicable, no anterior al fin observado ni futuro respecto de la fecha de negocio. DSO/DPO conservan su mes calendario y comparación de tres meses definidos en la fundación, sin una nueva ventana inferida.

## Contratos de datos propuestos

### A. Evidencia y completitud

Toda respuesta financiera debe identificar organizationId, moneda, corte/periodo, evidenceId de snapshot coherente, política de población/valoración/asignación y estado de completitud. Un booleano complete=true en los mocks no constituye prueba externa; en el adaptador sólo puede proceder de controles reales: paginación completa o RPC agregada con conteos, consistencia del snapshot, ausencia de truncamiento/errores y conciliación de importes. Ante falta de permiso, error, tasa ausente o cobertura parcial se devuelve N/D; jamás [] ni 0 como equivalente al fallo.

No se introducen nuevas lecturas directas desde la UI. El servicio proyectado recibirá contexto de organización y alcance autorizado; no se ampliarán RLS ni grants. El motor puro no reemplaza seguridad, validación de entrada ni la validación de certificados del servidor. Las fuentes deben estar en un único snapshot/transacción de lectura o certificar el mismo corte. Un evidenceId arbitrario del cliente no debe tener poder de certificación.

### B. CxC/CxP comparable

- Saldo: lado receivables/payables, periodo, serie daily-eod o opening-closing, importe neto comercial normalizado y evidencia por documento.
- Actividad: tipo credit-sales/credit-purchases-services, el mismo periodo/base/población/moneda/snapshot y actividad neta, incluidas NC conforme a política.
- Calendario: ISO YYYY-MM-DD de fecha de negocio ya resuelta en zona de la organización; el kernel hace aritmética de fechas puras sin reloj local ni UTC que desplace el día. No se fija el reloj del navegador como corte financiero.
- Promedio diario propuesto: media de cierres de todos los días calendario, incluidos fines de semana. El identificador daily-eod y la etiqueta lo hacen explícito. Apertura/cierre: (saldo al inicio del primer día + saldo al cierre del último)/2, mostrado como aproximación. No pasar de una variante a otra silenciosamente.
- Numerador incluye saldos comerciales todavía vivos aunque venzan después de 30 días o carezcan de vencimiento. Un saldo sin fecha sigue siendo saldo; puede quedar N/D su clasificación de aging.
- Saldos a favor y anticipos no se compensan libremente entre clientes/documentos. Se exponen aparte o se aplican según política con linaje; el kernel rechaza saldos negativos como deuda comercial.
- Denominador nulo/negativo: N/D con causa, no 0 días ni infinito. Saldo certificado igual a cero con actividad positiva: sí da cero.
- Tres meses: tres periodos calendario consecutivos terminando en el mes seleccionado y cerrados según configuración. No es trimestre fijo de 90 días. Mostrar cada mes, método y política. Si cambia una política, advertir comparación no homogénea o recalcular los tres bajo la nueva política con evidencia. No promediar los tres ratios simples como ratio del trimestre.

### C. Historia

Propuesta inicial conservadora: snapshots prospectivos certificados de cartera neta por día y cierres mensuales, con apertura verificable, política y versión. Si más adelante se construye ledger de eventos, separar effectiveDate y recordedAt, registrar reversos/correcciones/estados y garantizar atomicidad con la operación fuente. Los snapshots corregidos deben crear revisión auditable, no borrar la versión anterior. No hay migración en este paquete.

Para backfill: evidencia completa por documento y periodo. Donde falte, conservar N/D con causa y fecha desde la que empieza cobertura. Un cierre de periodo no es un backfill. No insertar eventos ficticios con fecha pasada para rellenar huecos.

### D. Aging

El saldo y el corte de clasificación deben coincidir. La fecha programada no interviene. Deuda que vence hoy permanece no vencida; después se agrupa 1–30, 31–60, 61–90, >90. Vencimiento desconocido se muestra en categoría separada con su importe, conservando el total conocido y declarando clasificación N/D. Fecha inválida, saldo desconocido o población incompleta: N/D, no desaparición del documento.

### E. Caja y forecast

Caja inicial: disponible al cierre del día anterior al inicio del horizonte, con evidencia de conciliación y revisión de disponibilidad. Todas las fuentes se convierten al mismo perímetro/moneda según política; no sumar numerarios diferentes.

Horizonte explícito: 13 ventanas consecutivas de siete días desde una fecha de inicio proporcionada; exactamente 91 días. No se impone lunes ISO ni se incluyen días previos al corte. Si el producto quiere semanas ISO, el adaptador debe solicitar corte domingo y fecha lunes correspondientes, sin mezclar caja de hoy con flujos del lunes pasado.

Evento previsto: identidad económica canónica, obligación, importe monetario residual, fecha prevista, fuente y clase de fecha (promesa, programación, escenario contractual o estimación expresa). Varias cuotas pueden compartir obligación pero tienen identidades distintas; su suma no excede el saldo monetario pendiente. Las obligaciones sin plan completo bloquean una previsión consolidada presentada como completa; escenarios parciales requieren otro contrato/etiqueta, no complete=true.

Las fechas después del día 91 se reconocen como fuera del horizonte; los vencidos sin fecha renovada quedan pendientes de revisión. Los estimados y escenarios contractuales permanecen identificados. No hay probabilidades ni supuestos ocultos.

Deduplicación: el adaptador debe unir banco ↔ pago ↔ lote ↔ anticipo ↔ factura mediante enlaces explícitos, producir una sola identidad económica y comprobarla contra caja al corte. El motor rechaza identidades duplicadas o ya realizadas y planes por encima del residual. No puede detectar por sí solo dos IDs distintos que en realidad representan el mismo hecho; eso requiere linaje y pruebas del adaptador.

### F. Runway

Input exclusivo de caja: disponible y conciliada al mismo corte explícito válido, desde el fin observado hasta la fecha de negocio inclusive, y eventos realizados durante los tres meses completos cerrados, con clasificación documental operativa propia. Un corte de caja posterior no extiende la ventana de consumo. No acepta ni consume EERR, utilidad, devengo o saldo de forecast como burn histórico.

Consumo neto = salidas incluidas − entradas incluidas. Runway en días = caja disponible / consumo neto × días observados. El resultado en días evita introducir una duración de mes no aprobada; el formato final de meses se definirá con la política del producto. Se muestran periodo y saldo disponibles. Consumo neto <=0 con caja positiva se informa sin consumo neto en ese periodo, no autonomía infinita. Caja cero/negativa tiene estado propio; incompletitud prevalece sobre un número aparente.

## Etapas propuestas de PR

1. Contrato/núcleo puro y pruebas. Sólo archivos nuevos de dominio/documentación; sin imports de producción. Revisión independiente. Permite verificar significado sin alterar pantallas ni fórmulas. Este es el alcance del candidato presente.
2. Inventario de datos reales, sólo lectura de la organización de prueba y esquema desplegado. Reportar cobertura por mes/documento/moneda y cerrar decisiones pendientes. No convertir un test unitario en declaración de conciliación real.
3. Normalizadores y read-model. Implementar saldos/cortes verificables, selección a crédito, impuestos/retenciones, principal/agente, FX y controles de completitud. SQL/migraciones, si resultan necesarias, van en un paquete separado revisado y probado. Sin reescribir historia desconocida ni ampliar permisos.
4. Caja disponible, fechas esperadas y linaje de eventos. Validar banco/lotes/anticipos, compromisos, promesas y planes; persistencia nueva sólo si se revisa por separado. Bloquear importes finales cuando la cobertura no alcance.
5. Integración UI. Conectar DSO/DPO a sus propias fuentes; selector de EERR deja de cambiar estas métricas. Mostrar tres meses, métodos, cortes y causas N/D. Aging y programación separados. Forecast 13 semanas y alertas con alcance temporal preciso; runway muestra fuente/horizonte de caja. Revisar colores: un DPO largo no demuestra por sí solo buen pago ni ausencia de mora.
6. QA integrada en Sandbox Chino Cochino, regresiones, volúmenes, tenant/roles, exportación y accesibilidad. Comparar importe por importe contra fuentes, probar mutaciones tardías y reintentos, luego CI/build completo de la rama final. Sólo después considerar sustitución de métricas vigentes.

Cambios de otro trabajador en paginación, servicios compartidos o layout deben integrarse por el coordinador; este paquete no los edita. Nada aquí aplica DB, fusiona Git ni publica producción.
