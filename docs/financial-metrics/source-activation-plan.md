# Fuente histórica y caja: plan de activación seguro

## Estado y decisión

Base inspeccionada: `088f3715bd3504b2dac92073239819039f306ba2`, árbol `3785f8f8805d4b936bcfd45933f3aa3247153b2a`. Auditoría de código y esquema versionado, no inspección ni certificación de la base desplegada. Los archivos de dominio, integración y fuentes citadas se verificaron por Git blob contra ese árbol. La copia de esquema usada para las conclusiones coincide con el blob `5a05f91329b9626284ed605a8ad0d9d137844310`.

**El mínimo seguro hoy es mantener N/D productivo y probar escenarios históricos en una suite sintética aislada.** Un adaptador que declare completos los lectores actuales sería incorrecto. No basta cambiar `numericEligible`, reenviar `complete: true`, usar la fecha de cierre configurada ni llenar `batches` con fixtures. Este paquete añade pruebas y diseño, no un certificado, lector numérico, migración, seed ni ruta productiva.

Los documentos de prueba capturados hoy pueden validar operación de CxC, CxP y Tesorería. Una `fecha_emision` de julio con `created_at` de octubre no prueba qué cartera existía en julio, cómo se aplicaron sus componentes ni que el periodo estuviera cerrado. Los fixtures aquí son inventados y no se insertan en Chino Cochino ni en otra empresa.

## Hallazgos verificables

| Capa | Código verificado | Lo que demuestra | Lo que falta |
| --- | --- | --- | --- |
| Servicio | [`financialAnalysis.ts`](https://github.com/jfcaicedoobando-arch/elogistix/blob/088f3715bd3504b2dac92073239819039f306ba2/src/features/dashboardEjecutivo/services/financialAnalysis.ts) | Proyecta monedas de filas actuales; llama diagnóstico con `batches: []`; contrato y salida `numericEligible: false` | Lector histórico y caja verificados; tampoco descubre monedas presentes sólo en historia |
| Diagnóstico | [`financialCoverage/diagnostics.ts`](https://github.com/jfcaicedoobando-arch/elogistix/blob/088f3715bd3504b2dac92073239819039f306ba2/src/features/dashboardEjecutivo/domain/financialCoverage/diagnostics.ts) | Observaciones y causas acumuladas, sin autoridad certificadora | Sus ocho queries no prueban snapshot, completitud, cierre, aplicaciones o conciliación |
| Integración | [`useDashboardEjecutivo.ts`](https://github.com/jfcaicedoobando-arch/elogistix/blob/088f3715bd3504b2dac92073239819039f306ba2/src/features/dashboardEjecutivo/hooks/useDashboardEjecutivo.ts) | CxC, CxP y bancos actuales; el análisis es independiente del error/fuente EERR | No consulta historia ni endpoint de certificados |
| Presentación | [`BandaKPIsEficiencia.tsx`](https://github.com/jfcaicedoobando-arch/elogistix/blob/088f3715bd3504b2dac92073239819039f306ba2/src/features/dashboardEjecutivo/components/BandaKPIsEficiencia.tsx) | Muestra N/D, causas y periodos | No tiene rama de valores certificados; cambiar sólo el servicio tampoco habilita tarjetas |
| Motores puros | [`approvedCalculations.ts`](https://github.com/jfcaicedoobando-arch/elogistix/blob/088f3715bd3504b2dac92073239819039f306ba2/src/features/dashboardEjecutivo/domain/financialMetrics/approvedCalculations.ts) | Fórmula, políticas aprobadas, periodo y alcance | Confía en entradas normalizadas; `evidenceId` y `complete` no autentican una fuente |
| Reloj | [`useDiaNegocio.ts`](https://github.com/jfcaicedoobando-arch/elogistix/blob/088f3715bd3504b2dac92073239819039f306ba2/src/hooks/shared/useDiaNegocio.ts) | Referencia UI del día CDMX | Fecha de negocio y zona resueltas por el servidor al leer evidencia |
| Banco actual | [`resumen.ts`](https://github.com/jfcaicedoobando-arch/elogistix/blob/088f3715bd3504b2dac92073239819039f306ba2/src/features/tesoreria/services/resumen.ts) | Suma saldo inicial + movimientos; filtra cuentas activas y no borradas | Perímetro de cuentas al corte, extractos, restricciones y corte conciliado |
| Estado de cuenta | [`estadoCuenta.ts`](https://github.com/jfcaicedoobando-arch/elogistix/blob/088f3715bd3504b2dac92073239819039f306ba2/src/features/tesoreria/services/estadoCuenta.ts) | Distingue historial anterior al arranque y recorta periodo | `cobertura_historica: completa` no equivale a evidencia externa íntegra, conciliada y disponible |

En el [baseline SQL de esa revisión](https://github.com/jfcaicedoobando-arch/elogistix/blob/088f3715bd3504b2dac92073239819039f306ba2/supabase/schema/baseline.sql):

- Líneas 6733–6784: `actualizar_cierre_periodo` guarda la fecha en `configuracion` y registra anterior/nueva/retroceso/motivo en bitácora. No crea snapshots ni comprueba apertura, impuestos, bancos o población completa.
- Líneas 12105–12123: `cierre_periodo_fecha` devuelve una configuración. No es el certificado de datos de un mes.
- Líneas 7966 y 13330: `proveedor_facturas` y `facturas` tienen totales e impuestos, fechas, estados y días/metodología fiscal de pago. Esos campos por sí solos no representan selección comercial explícita crédito/contado ni principal/agente.
- Línea 36861: `pagos_factura` guarda monto, moneda, TC, importe aplicado y retenciones; no tiene un registro completo de aplicación documental separada por principal/IVA/otros impuestos para reconstruir siempre cartera neta sin prorrateo. Los componentes de una factura no resuelven automáticamente los de un pago parcial.
- Línea 35407: `bbva_movimientos` contiene cargos/abonos, origen, conciliación y enlaces de pago/lote/anticipo/traspaso. No persiste un perímetro completo de extractos del periodo ni revisión de restricciones de caja.
- Línea 36381: `cuentas_bancarias` conserva saldo/fecha inicial, moneda y estado actual. Una cuenta inactiva hoy pudo pertenecer al perímetro del corte histórico; no se debe descartarla automáticamente.

## Dos usos de los datos mock

1. **Datos operacionales de Sandbox:** emitidos/capturados/abonados por los flujos legítimos. Sirven para probar UI, saldos actuales, cancelación, notas y linaje disponible. Mantienen las fechas reales de captura/auditoría. La configuración de cierre no se cambia para aparentar cobertura histórica.
2. **Escenarios históricos de cálculo:** fixtures unitarios sólo en `__tests__`, organización `synthetic-source-contract-only`, referencias `synthetic-only-*`. Pueden representar tres meses completos inventados para comprobar matemáticas y errores. Nunca se cargan como certificados reales ni se mezclan con respuesta de producción.

Si se necesita una demo visual posterior, debe ser una superficie explícita y separada de simulación, con datos exclusivamente sintéticos, marca persistente de simulación y exportaciones igual de marcadas. No es parte de este candidato. No usar un toggle de `numericEligible` o una flag del cliente sobre el dashboard real.

## Contrato del futuro lector autorizado

El lector debe construir y comprobar la evidencia **en el servidor**, bajo el alcance/rol efectivo del usuario. La petición del cliente sólo seleccionará mes, moneda y corte permitido. No aceptará `complete`, importes, `evidenceId`, cierre, restricciones ni `certification` como declaraciones autoritativas del cliente. La seguridad sigue siendo la de la organización y los roles existentes; este diseño no amplía RLS, grants ni acceso.

La respuesta deberá separar cada indicador/mes/moneda con una unión estricta:

- `unavailable`: causas verificadas y datos/periodos faltantes; sin número utilizable. Fallo de lectura, falta de permiso, truncamiento o discrepancia de ámbito no producen cero ni una respuesta vacía válida.
- `ready`: valor derivado y método; organización, moneda documental, periodo, corte y fecha/zona de negocio; versión de políticas; revisión de cierre; revisión de evidencia y procedencia auditada por el servidor. Sólo se crea después de comprobar todos los gates aplicables.

Un UUID, checksum, firma o bandera demuestra identidad/integridad sólo según su mecanismo; por sí solo no demuestra veracidad/completitud económica. El verificador debe comprobar el contenido y su origen, no sólo el formato del sobre. El cálculo debe efectuarse dentro de esa frontera o sobre una respuesta cuya autorización y revisión hayan sido resueltas allí. TypeScript no constituye frontera de confianza.

### Gates comunes

1. Autenticación, organización efectiva y roles permitidos, sin leer ni reflejar evidencia de otras empresas. Resolver moneda con catálogo autorizado.
2. Fecha de negocio del servidor con zona explícita. Mes calendario terminado y cierre revisionado vigente que cubra el periodo. Una reapertura invalida elegibilidad sin destruir las revisiones previas.
3. Lectura consistente: una transacción/snapshot o una revisión inmutable completa. Completar paginación dentro del mismo corte; no equiparar menos filas que LIMIT con población completa.
4. Manifest por alcance con conteos/controles monetarios reconciliados y versión de reglas. Detectar fuentes faltantes, errores, duplicados y registros tardíos. Un manifest vacío sólo es cero conocido si el control de población lo acredita.
5. Mantener `effectiveDate` y `recordedAt` distintos. Una corrección tardía crea una revisión auditable que invalida/recalcula cierres dependientes. No cambiar silenciosamente el resultado ya certificado.
6. No reutilizar la caché del EERR. Clave/invalidation por organización, moneda, mes, corte, revisión de cierre, versión de políticas y revisión de fuente; respuesta tardía de otro alcance se descarta.

### DSO/DPO: evidencia mínima por documento

- Clasificación comercial explícita propia/terceros y crédito/contado, con vigencia y procedencia documental. PPD, PUE, días o notas no sustituyen la clasificación.
- Importe original por componentes neto/impuestos/retenciones, moneda y precisión; comprobación de identidad aritmética y documento/versión de origen. Actividad y cartera comparten base, población, moneda y snapshot.
- Toda reducción/reversión debe identificar documento, fecha efectiva, componente neto/impuesto/retención, moneda documental y evidencia. Incluir NC, pagos, anticipos aplicados, ajustes no monetarios y reversos sin confundirlos entre sí. Intermoneda exige ambos importes documentales y enlace/tasa de esa aplicación, sin TC actual.
- Apertura verificable y todos los movimientos efectivos que expliquen cada saldo al corte. Deuda sin vencimiento sigue en la cartera; no recortar a próximos 30 días. Saldos a favor se separan y no compensan libremente otras obligaciones.
- Preferir promedio diario sólo con todos los días, incluidos fines de semana. Si únicamente existen apertura/cierre completos, ofrecer exclusivamente ese método con etiqueta de aproximación y criterio de elección explícito; no hacer fallback silencioso por datos ausentes.
- DSO: ventas netas propias a crédito. DPO: compras/servicios netos propios a crédito. Actividad no positiva → N/D. Saldo neto completo igual a cero con actividad positiva → cero días.

Ejemplo sintético que el normalizador debe resolver documentalmente: factura neta 100 + IVA 16 = total 116; pago 58 con asignación explícita neto 42 e IVA 16 deja cartera neta 58. Prorratear 58/116 sobre neto 100 daría 50 y sería incorrecto. Si esa aplicación por componentes falta, la respuesta debe ser N/D, aunque factura y pago cuadren en bruto. Este paquete no introduce una inferencia alternativa.

### Runway: evidencia mínima de efectivo

- Tres meses calendario consecutivos completos cerrados que terminan en el mes seleccionado. El horizonte no se amplía por una caja conciliada posterior; 1-julio a 30-septiembre son 92 días.
- Universo de cuentas/fondos que pertenecían al perímetro durante la ventana y al corte de caja, incluidos cierres/inactivaciones. Cada cuenta tiene moneda y apertura verificable; no omitir cuentas históricas por su flag actual.
- Extractos/importaciones con integridad y rango completos, saldos inicial/final y control de movimientos; conciliación al mismo corte, diferencias explicadas y sin pendientes que alteren disponible. Una marca Conciliado no sustituye esto.
- Restricciones explícitas y vigentes por cuenta/fondo al corte; caja disponible derivada del efectivo conciliado menos restricciones, sin compensación entre monedas.
- Identidad económica única y linaje banco ↔ pago ↔ lote ↔ anticipo ↔ devolución ↔ traspaso. Enlaces duplicados o incompletos bloquean el agregado; dos IDs distintos para el mismo dinero también deben deduplicarse mediante el grafo de origen.
- Clasificación documental de cada evento: operación propia, inversión, financiación, terceros o transferencia interna. Sólo operación propia entra al consumo neto; la comisión operativa se conserva como evento separado de las patas internas.
- Caja válida no anterior al último cierre observado y no posterior a la fecha de negocio. Restricciones y conciliación pertenecen a ese mismo corte. Caja cero/negativa y periodo sin consumo neto son estados distintos de falta de datos; nunca autonomía infinita.

## Plan incremental recomendado

### Paquete A: observaciones reales y UX de faltantes

Conectar un lector sólo diagnóstico para las ocho observaciones existentes. Envolver sus resultados con organización y fechas reales del servidor, validarlos mediante `diagnoseFinancialCoverage`, y distinguir ausente, error, incompleto y observado. No habilita números. El cliente no envía batches como prueba. Este paso hace el N/D más concreto y permite medir qué falta después del seed operacional.

Criterio de salida: respuestas de error/parciales/otro tenant nunca pasan por cero; no hay nueva rama numérica, y se conserva independencia EERR y relojes. El SQL concreto necesita revisión contra esquema desplegado y pruebas de roles antes de migrarse.

### Paquete B: evidencia prospectiva de cartera

Definir persistencia versionada para bases comerciales/documentales y aplicaciones por componentes. Reutilizar IDs fuente, no duplicar operaciones de dinero. Capturar snapshots prospectivos inmutables por documento/día o apertura/cierre, con manifest de completitud y revisionado de cierre. La evidencia de origen puede ser documento/importación revisada; registrar fuente y vigencia sin afirmar retrospectivamente lo que no existe.

Para histórico anterior sólo admitir importación/reconstrucción que tenga apertura y eventos/comprobantes completos. Si no hay documentos suficientes, publicar fecha inicial de cobertura y N/D anterior. No llenar huecos diarios, inventar `created_at` ni volver el cierre configurado un certificado. Si la primera cobertura válida empieza a mitad de octubre, septiembre seguirá N/D; la primera mensualidad elegible depende de una apertura verificable y un mes completo cerrado, no de una fecha prometida ahora.

Criterio de salida: un mes/moneda puede habilitar DSO o DPO independientemente sólo si su población completa está demostrada; no bloquear un indicador válido por otro sin evidencia, ni mostrar promedio trimestral fabricado. Comparación muestra cada mensualidad y método.

### Paquete C: evidencia prospectiva de caja

Añadir manifests de extractos/cobertura por cuenta, clasificación monetaria, linaje canónico y restricciones de disponibilidad revisionadas. Reusar movimientos/bancos existentes y conservar revisiones; no modificar una conciliación histórica con un flag global.

Criterio de salida: control exacto por cuenta/moneda, pruebas de falta de extracto, cuenta inactiva al presente, traspaso intermoneda, comisión, devolución, anticipo, lote y ajuste no monetario. Runway sólo después de tres meses completos cubiertos y caja conciliada disponible al corte. No sustituir por pérdida EERR ni forecast.

### Paquete D: lector/verificador y presentación numérica

Implementar endpoint server-side a partir de B/C. Revisar controles de tenancy, versión, cierre/reapertura y snapshot. El servicio productivo debe reemplazarse por un resultado discriminado por indicador que use sólo ese lector, no ampliar el contrato diagnóstico para aceptar un flag.

Conectar UI y exportación mostrando fuente/revisión, mes, método, moneda, corte de caja, ventana de consumo y causas pendientes. Exportación debe conservar esos mismos datos. Probar cambio de organización/moneda/periodo, respuestas tardías, error/reintento, cierre reabierto y fuente desactualizada. Mantener el display N/D como rama real de primer nivel.

Criterio de salida: importes trazados de extremo a extremo contra las fuentes autorizadas, QA Sandbox, controles de RLS/roles, tests de migración/replay/rollback, CI completa y build de la revisión final. Las pruebas puras de este paquete no sustituyen esas comprobaciones.

## Escenarios ejecutables añadidos

Archivo: `src/features/dashboardEjecutivo/domain/financialMetrics/__tests__/sourceActivationContract.test.ts`, 32 casos nuevos. No hay fixture compartido con producción ni importación desde UI. Los resultados esperados son deliberadamente distintos por moneda:

| Escenario sintético | Jul (31 días) | Ago (31 días) | Sep (30 días) | Runway Jul–Sep |
| --- | ---: | ---: | ---: | ---: |
| MXN DSO y DPO, cartera/actividad = 0.5 | 15.5 días | 15.5 días | 15 días | 92 días de caja, consumo neto 150,000 unidades menores |
| USD DSO y DPO, cartera/actividad = 0.25 | 7.75 días | 7.75 días | 7.5 días | 184 días de caja, consumo neto 30,000 unidades menores |

Los importes son enteros de unidades menores por moneda. No se suman MXN y USD. Esta igualdad entre DSO y DPO dentro de cada fixture sólo reduce datos de prueba; no implica que los indicadores reales compartan población o actividad.

Otros casos: apertura/cierre aproximado; hueco diario; cero completo frente a ausencia/denominador cero; scope/moneda/revisión ajenos; políticas inferidas; cierre ausente/incompleto; conciliación/restricciones ausentes; evento duplicado; exclusión de inversión/financiación/terceros/traspaso conservando comisión; límite productivo que rechaza resultados sintéticos y aprobaciones fabricadas; seed con PPD/días/fechas/Conciliado que sigue N/D.

Límite de estas pruebas: son contratos matemáticos y de aislamiento ya implementados. No prueban extracción documental, normalización neta, autoridad del lector, snapshot real, RLS, extractos o cierre de Chino Cochino. Los escenarios que requieren nueva persistencia/verificador quedan en los criterios de salida anteriores, no se marcan como pasados.

## Validación local

- 282 pruebas pasadas en 9 archivos de dominio/cobertura: 250 existentes y 32 nuevas.
- TypeScript estricto del subárbol aislado: pasa.
- ESLint del archivo nuevo usando reglas del repo: pasa.
- Control negativo aislado: cambiar deliberadamente la salida productiva a `numericEligible: true` provoca los dos fallos esperados en el contrato de aislamiento; las otras 30 pruebas nuevas siguen pasando. La mutación no está en el candidato.
- Harness local esbuild/Node y dependencias ya disponibles; no se cambió configuración del repositorio ni se instalaron dependencias.
- Pendiente/no ejecutado: build completo, CI remoto, navegador/E2E, consultas DB, migraciones, permisos/RLS desplegados y cifras reales. No hubo escritura remota.

El candidato publicable consta sólo del test nuevo y este documento. El harness, fuentes copiadas sin cambios y evidencia de ejecución permanecen separados como material de revisión.
