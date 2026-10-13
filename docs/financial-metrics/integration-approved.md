# Primera integración segura de DSO, DPO y runway

Base: ee8ba3ac15720680a1d2de82eaec2e1bd73ece96. Aprobación explícita de los cinco criterios: 2026-10-13 12:32 UTC. Esta aprobación no certifica datos.

## Fuentes versionadas disponibles y límite exacto

Los lectores actuales inyectan CobranzaRow/CxpRow: moneda, saldo monetario vivo, vencimiento y programación CxP. fetchSaldosCuentas aporta cuenta, moneda y saldo nominal actual. El esquema versionado documenta subtotal/IVA/retenciones, NC, fechas de pago y monto aplicado; no se consulta DB ni se afirma completitud/despliegue real.

No hay en esos lectores: clasificación histórica de crédito comercial ni propia/terceros; apertura/serie/cierre histórico neto con aplicaciones fiscales documentales; extractos/cuentas completos conciliados al corte y restricciones; población completa clasificada de flujos operativos de tres meses cerrados. Es dato faltante, no permiso faltante. No se prueba un permiso denegado ni se crean nuevas superficies de acceso.

## Comportamiento conectado

buildFinancialAnalysis usa sólo las monedas realmente observadas en CxC/CxP/cuentas, sin importes, sin FX y sin fabricar batches de auditoría. Lista vacía o moneda desconocida produce ámbito desconocido N/D, nunca MXN cero. Las monedas observadas no prueban el universo histórico completo. El diagnóstico puro mantiene numericEligible:false incluso con IDs, complete:true o certification enviados por un cliente.

El snapshot y las tarjetas contienen N/D y causas por organización/moneda/mes/referencia de lectura. Referencia de cartera actual no es corte financiero certificado ni reloj de negocio verificado. Se muestran las tres mensualidades solicitadas para comparación DSO/DPO y consumo runway; su cierre/cobertura y método siguen sin verificar. Falta método: no se elige silenciosamente apertura/cierre. Aprobación de políticas y datos pendientes se presentan por separado.

Los campos heredados dso_dias/dpo_dias/runway_meses quedan null: se eliminan CxC/CxP próximos 30d dividido por EERR y pérdida EERR como burn. No hay fallback oculto en servicios o tarjetas. Los demás KPIs y forecast actual conservan su alcance. EERR, TC y reprogramación no cambian nuevas métricas ni causas. Reprogramar puede cambiar el forecast existente, nunca equivale a pago o reducción del DPO.

El diagnóstico se construye en el hook con las fuentes actuales de CxC/CxP y el lector existente de saldos bancarios, cuya caché ya está separada por organización. Esas mismas cuentas se inyectan al snapshot, sin duplicar la consulta bancaria. La referencia sigue el día mostrado por la aplicación y no certifica un corte. El panel se presenta fuera de las ramas de carga/error del EERR: un EERR fallido o pendiente no lo oculta ni cambia sus causas. Carga y error de las propias fuentes financieras se muestran explícitamente como N/D, sin retener un diagnóstico anterior. No hay caché de certificados ni nuevas consultas SQL. Un lector futuro necesitará claves por corte certificado, moneda, política y snapshot propios; aún no existe y no se promete consistencia transaccional.

## Cálculos puros preparados, sin habilitación numérica productiva

calculateApprovedEfficiency reutiliza núcleo mensual: mismo periodo/base/población/snapshot, moneda documental, netos documentados y actividad propia a crédito. Denominador no positivo queda N/D; saldo neto verificado cero con actividad positiva da cero. No recibe PPD/días como reglas ni normaliza bruto/impuestos.

calculateApprovedRunway reutiliza núcleo de caja y exige observedPeriod exactamente igual a tres meses calendario consecutivos completos cerrados que terminan en selectedMonth. Caja y conciliación coinciden en un corte explícito válido, no anterior al fin observado ni posterior a businessToday; el corte puede ser posterior al último cierre sin extender los tres meses de consumo. Las clasificaciones documentales explícitas incluyen únicamente operación propia; inversión, financiación, terceros y patas internas se excluyen, pero no comisiones operativas. Cada evento mantiene organización/moneda. El resultado se expresa en días según días reales, sin convertir a meses convencionales. Falta cobertura, clasificación, cierre, disponibilidad o conciliación: N/D.

Son funciones puras, no verificadores. Sus mocks no constituyen certificados externos. Sólo un futuro lector/verificador revisado podrá alimentar números; ningún caller productivo actual las invoca con complete/evidenceId fabricados. La UI no tiene rama numérica mientras falte ese lector.

## Validación y alcance

Pruebas semánticas/mock: meses reales y bisiesto, tres meses exactos, monedas, cero vs ausencia, denominador no positivo, clasificación/exclusiones, errores, cambio de organización, EERR independiente y programación independiente de DPO. Se comparan base y candidato con harness separado por el bloqueo SWC ya diagnosticado, sin repetirlo ni instalar bindings. Se reutilizan dependencias npm aisladas; no instalación congelada Bun ni cambio de configuración del repo.

El PDF actual no contiene DSO/DPO/runway; se conserva y se prueban sus regresiones existentes. Exportar estas métricas con periodos, método y causas queda pendiente para un paquete explícito. No se afirma una exportación nueva, QA browser/E2E, DB real, RLS ni certificación financiera. Sin migraciones, escrituras remotas, despliegues o datos vivos. Los paquetes anteriores y PR299/300 no se modifican.

## Revisión independiente de integración

Se corrigieron dos límites detectados: el panel ya no depende del éxito/carga del EERR y la caja de runway puede corresponder a un corte explícito posterior al horizonte de consumo cerrado. Pruebas de hook y página cubren EERR fallido/pendiente, reutilización del lector bancario, cambio de fuente, error/reintento de banco y respuesta tardía de otra organización. Ninguna corrección habilita importes productivos ni acredita datos reales.
