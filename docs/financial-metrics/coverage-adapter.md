# Etapa 3 preparatoria: cobertura observada y causas N/D

## Resultado y límite de autoridad

Adaptador puro, local y sin efectos para transformar ocho estructuras de agregados del inventario de veinte SELECT en un diagnóstico por organización, corte solicitado y moneda. Está junto al núcleo de etapa 1, pero no habilita números y no consulta bases de datos. La primera integración UI se documenta en integration-approved.md.

La salida siempre contiene `status: 'unavailable'`, `numericEligible: false` y `certification: 'not-evaluated'`. Cada indicador conserva N/D y sus causas acumulativas. No existe rama `ready`, `evidenceId`, `complete`, importe financiero, certificación de datos ni conversión a `Scope`/`ComparableScope`. Agregar estos atributos al JSON de entrada no les otorga autoridad.

Esta restricción es deliberada: los SELECT inspeccionados muestran cobertura y problemas, pero no prueban un cierre aprobado, historia íntegra, conciliación documental, caja disponible ni un snapshot coherente. Un futuro verificador real y su contrato requerirán revisión separada; un identificador, booleano o texto enviado por el cliente nunca lo sustituye.

## Archivos y dependencia

Código candidato nuevo: `src/features/dashboardEjecutivo/domain/financialCoverage/`.

- `contract.ts`: contrato público diagnóstico y vocabulario de causas.
- `parsing.ts`: validación exacta de conteos y fechas; proyección de campos permitidos.
- `schemas.ts`: proyecciones de las ocho consultas observadas, límites y reglas de consistencia.
- `observations.ts`: validación del sobre, organización, fuentes y filas; eliminación de datos no necesarios.
- `diagnostics.ts`: tres períodos calendario, datos pendientes, causas acumuladas y salida siempre N/D.

Pruebas nuevas: `src/features/dashboardEjecutivo/domain/financialCoverage/__tests__/{fixtures,diagnostics.test,validation.test,review-regressions.test}.ts`. Fixtures ficticios y valores de prueba; no contienen UUIDs, documentos, importes, nombres ni filas exportadas de la empresa auditada. Los nombres de columnas y formas provienen del inventario; los valores de ejemplo no son resultados del negocio.

Única dependencia del núcleo etapa 1: utilidades puras de fecha y tipo `Period` en `financialMetrics/calendar.ts`. No se modifica ninguno de sus quince archivos revisados. No se agregan paquetes, cambios de esquema, funciones SQL, GRANT, rutas, servicios, pantallas ni imports productivos.

## Entrada y procedencia

`diagnoseFinancialCoverage(input: unknown)` valida en tiempo de ejecución:

1. `request`: `organizationId`, código de moneda de tres letras mayúsculas, `asOf` como fecha civil de negocio y `selectedMonth` para comparar tres meses. El parser valida formato, no pertenencia al catálogo ISO; el lector autorizado debe validarla contra su catálogo antes de integrar. Se admite un mes aún abierto para poder explicar por qué es N/D. El rango de tres meses no puede preceder al año 0001.
2. `batches`: sobre por consulta reconocida con la misma organización, `observedAt` UTC canónico con milisegundos, fecha de negocio explícita, `outcome`, `partialResponse` y filas si la respuesta fue exitosa.

El sobre atribuye una observación; no autentica al llamador ni acredita RLS. Si una fila incluye además `organization_id`, debe coincidir. Una fuente de otra organización se descarta íntegra sin reflejar sus identificadores o conteos. Consultas desconocidas, filas duplicadas o inválidas y entregas duplicadas de una consulta se descartan; otras fuentes válidas conservan sus diagnósticos.

El lector futuro debe normalizar el instante del servidor a UTC canónico sin sustituirlo por la hora del navegador. La fecha de negocio es explícita y no se obtiene de la zona del navegador. Para la consulta de cierre, su `database_date` debe coincidir con el sobre o se descarta: el lector debe resolver la zona de negocio/DB, no reenvasar una consulta de otro día. Una discrepancia respecto de `request.asOf` queda marcada y conserva sólo la observación como contexto, sin atribuir al corte causas específicas de cierre, NC, vencimientos o programación de esa lectura. Aun si coincide, las consultas actuales no se convierten en balances históricos.

El intervalo de lectura incluye las respuestas exitosas válidas, incluidas las vacías. Su consistencia es siempre `unverified`; no abarca respuestas fallidas/descartadas y no certifica atomicidad. Conteos repetidos iguales, un solo instante informado o una entrega menor que LIMIT no certifican completitud.

## Proyecciones del inventario

| Consulta | Datos retenidos | Eje y cautela |
| --- | --- | --- |
| 02 cobertura | fuente, conteos y primera/última fecha | Contexto de organización. No se reparte entre monedas ni prueba apertura o ausencia histórica. Las fechas pueden incluir filas borradas porque el SQL original no filtra los min/max por `deleted_at`. |
| 04 cierre | cantidad de configuraciones, fecha configurada única y fecha DB | Configuración observada, nunca cierre certificado. Cero configuraciones es distinto de una lectura ausente/errónea. Si hay dos, no se elige la mayor. |
| 05 bancos | moneda, flags activo/borrado, fechas y conteos | Eje moneda de cuenta; no se retienen ID, saldo, cargos o abonos. `rows_with_statement_balance` significa campo `saldo` no nulo; no acredita extracto externo. No filtra hasta el corte pedido. |
| 06 crédito/impuestos | lado, estado y conteos de campos existentes | Contexto de organización. PPD/PUE, días positivos y estado pagado no acreditan clasificación comercial al origen. |
| 10 pagos | lado, ambas monedas y conteos de vínculos/ajustes/anticipos | Moneda principal de caja y moneda relacionada del documento. Se ignoran ambos importes. Ajustes y aplicaciones de anticipos no se convierten en egresos. `no_account` y `bank_linked` no son una partición. |
| 14 calidad histórica | lado y conteos observados | Contexto de organización; las columnas y SQL del inventario usan un umbral concreto de octubre. No se reinterpretan como el período pedido ni se parametrizan tácitamente. |
| 15 NC CxP | moneda de factura, moneda de NC, estado y conteos | Eje principal moneda de factura. Una NC en una moneda aplicada a factura en otra afecta la base documental de esta última. El agregado carece de delimitación del período; se etiqueta como bloqueo observado, no como importe del mes. |
| 17 cartera CxP actual | moneda, estado/aprobación, conteos y fechas de programación | Observación de cartera actual; `current_date` y saldo actual no reconstruyen un corte anterior. La programación no reemplaza vencimiento contractual. |

No se importa la consulta 08, cuyos importes documentales agregan monedas distintas. Tampoco se importa una muestra de IDs como si fuera población, ni metadata de esquema como evidencia de que existen registros. Las otras doce consultas sostienen el análisis de límites y el diseño; no todas necesitan un parser para este diagnóstico.

Los conteos pueden llegar como enteros o strings enteros decimales exactos y no negativos, dentro de `Number.MAX_SAFE_INTEGER`. Se rechazan fracciones, notación parcial/exponencial, valores no finitos y desbordamientos. Un conteo opcional `null` se conserva como desconocido por ausencia del campo en `counts`; nunca se normaliza a cero. Un campo requerido ausente invalida la fuente. No hay redondeo ni conversión monetaria.

Los estados de enum soportados son los contemplados por estas estructuras; un valor nuevo no reconocido falla cerrado, sin traducirlo a un estado conocido por heurística. Los límites son los del inventario: 20/1/100/30/80/2/30/30. Alcanzar un límite de resultados variable se marca como posiblemente truncado. Las consultas de una fila y UNION de dos agregados tienen cardinalidad fija. Los límites acotan la respuesta procesada, no garantizan costo del SELECT ni población completa.

## Diagnóstico acumulativo

La salida separa:

- `observations`: proyecciones explícitas sin importes, PII o identificadores fuente. `queryId` y `rowIndex` sólo ubican una fila en esta lectura; no son certificados.
- `sources`: `observed`, `empty-response`, `error`, `invalid`, `missing`, `scope-mismatch`, `duplicate` o `possibly-truncated`. `observed` no significa `complete`.
- `causes`: código, explicación, indicadores afectados y base `observed-gap`, `unverified-prerequisite` o `invalid-input`. Diferentes filas pueden compartir un código con referencias distintas; cada indicador deduplica sus códigos.
- `policies`: las cinco claves con `approved` y fecha `2026-10-13T12:32:00Z`. Es la aprobación explícita recibida, nunca una propiedad aceptada del JSON ni certificación de datos.
- `metrics`: DSO, DPO, aging, forecast de trece semanas y runway en estado `unavailable`, con todas sus causas.

Causas principales: período no cerrado, cierre no configurado/no verificado, historia no reconstruida, clasificación comercial y principal-agente sin verificar, política de base fiscal/FX sin verificar, bases NC faltantes, caja no conciliada/disponibilidad sin verificar, cobertura y linaje de flujos incompletos, fechas previstas faltantes y vencimientos contractuales desconocidos. Una observación sin problemas visibles no elimina las causas de certificación pendiente.

Los bloqueos monetarios por documento se atribuyen a la moneda pertinente. Los conteos de organización permanecen como contexto. Las bases faltantes de NC aplicadas afectan DPO; notas borrador no se convierten en actividad emitida. Faltantes de calendario de pagos afectan forecast, no cambian DPO. El aging de este diagnóstico no utiliza programación como fecha contractual. Los detalles de historia pendiente se separan: tres meses comparables para DSO/DPO, población de saldo al corte para aging y los tres meses completos cerrados aprobados para runway. La integración comprueba esa ventana explícitamente; el identificador de política no prueba cobertura.

## Integración inicial y lectura futura

La primera integración usa el cliente, servicios y caché existentes; no ejecuta SELECT de auditoría, lecturas information_schema ni bitácoras, no introduce RPC ni cambia RLS/grants. Usa monedas observadas como contexto, sin proyectarlas a historia ni caja certificada. Estado/corte/método N/D aparecen por moneda y se retiran los ratios financieros heredados insuficientes del snapshot. Ver integration-approved.md.

Un futuro lector/verificador requerirá organización y superficie autorizada explícitas, cobertura completa y coherencia de corte/snapshot. Paginación completa no constituye por sí sola historia o conciliación. Falta de permiso deberá informarse sin eludir acceso; este paquete no necesita ni solicita acceso nuevo.

## Políticas aprobadas; datos todavía sin certificar

El 13 de octubre de 2026 a las 12:32 UTC el usuario aprobó los cinco criterios: crédito/contado y propia/terceros documentados; netos/impuestos documentados sin prorrateo automático; moneda documental sin consolidación automática; consumo operativo neto de tres meses completos cerrados excluyendo inversión/financiación/terceros; efectivo conciliado y restricciones explícitas.

La aprobación fija las reglas y no valida filas, historia, extractos ni importes. El diagnóstico sigue siempre N/D/numericEligible:false. Las causas describen evidencia faltante, no una aprobación pendiente. No se ejecutan los SELECT de auditoría en navegador ni se simulan sus agregados a partir del snapshot ejecutivo.

La primera integración está descrita en `integration-approved.md`: reutiliza únicamente monedas observadas de lectores existentes, muestra periodos/corte/método pendientes de certificación, mantiene campos heredados null y evita EERR como fallback. Sigue pendiente un lector/verificador real con historia, clasificación documental, impuestos/aplicaciones, conciliación y restricciones. Identificadores o flags del cliente no lo sustituyen.

## Verificación y entrega

Desde el directorio local `candidate` se ejecutan tests Vitest, TypeScript estricto y ESLint con la configuración real del repo. La evidencia de esta etapa se guarda aparte, junto con la revisión independiente y los manifiestos. Esas pruebas aisladas no equivalen a build/suite/guards de toda la app ni QA browser/DB, que no se ejecutan en este cambio.

`stage3-delta-manifest.json` / `stage3-delta.patch` contienen sólo nueve archivos nuevos de código/pruebas más este documento. `combined-manifest.json` / `combined.patch` contienen los quince archivos de etapa 1 sin cambios más los diez archivos nuevos. Ambos se anclan al commit base solicitado. El inventario vivo, SQL con UUIDs y respuestas remotas quedan fuera de todos los manifiestos Git. Ninguna publicación, migración, mutación DB ni despliegue forma parte de esta entrega.
