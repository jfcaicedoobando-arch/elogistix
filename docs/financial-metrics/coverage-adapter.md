# Etapa 3 preparatoria: cobertura observada y causas N/D

## Resultado y límite de autoridad

Adaptador puro, local y sin efectos para transformar ocho estructuras de agregados del inventario de veinte SELECT en un diagnóstico por organización, corte solicitado y moneda. Está junto al núcleo de etapa 1, pero no lo invoca, no cambia números productivos y no consulta bases de datos.

La salida siempre contiene `status: 'unavailable'`, `numericEligible: false` y `certification: 'not-evaluated'`. Cada indicador conserva N/D y sus causas acumulativas. No existe rama `ready`, `evidenceId`, `complete`, importe financiero, autorización de políticas ni conversión a `Scope`/`ComparableScope`. Agregar estos atributos al JSON de entrada no les otorga autoridad.

Esta restricción es deliberada: los SELECT inspeccionados muestran cobertura y problemas, pero no prueban un cierre aprobado, historia íntegra, conciliación documental, caja disponible ni un snapshot coherente. Un futuro verificador real y su contrato requerirán revisión separada; un identificador, booleano o texto enviado por el cliente nunca lo sustituye.

## Archivos y dependencia

Código candidato nuevo: `src/features/dashboardEjecutivo/domain/financialCoverage/`.

- `contract.ts`: contrato público diagnóstico y vocabulario de causas.
- `parsing.ts`: validación exacta de conteos y fechas; proyección de campos permitidos.
- `schemas.ts`: proyecciones de las ocho consultas observadas, límites y reglas de consistencia.
- `observations.ts`: validación del sobre, organización, fuentes y filas; eliminación de datos no necesarios.
- `diagnostics.ts`: tres períodos calendario, políticas pendientes, causas acumuladas y salida siempre N/D.

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
- `policies`: las cinco claves, todas con `approval-unverified`. Las recomendaciones previas no se aceptan como decisiones contables.
- `metrics`: DSO, DPO, aging, forecast de trece semanas y runway en estado `unavailable`, con todas sus causas.

Causas principales: período no cerrado, cierre no configurado/no verificado, historia no reconstruida, clasificación comercial y principal-agente sin verificar, política de base fiscal/FX sin verificar, bases NC faltantes, caja no conciliada/disponibilidad sin verificar, cobertura y linaje de flujos incompletos, fechas previstas faltantes y vencimientos contractuales desconocidos. Una observación sin problemas visibles no elimina las causas de certificación pendiente.

Los bloqueos monetarios por documento se atribuyen a la moneda pertinente. Los conteos de organización permanecen como contexto. Las bases faltantes de NC aplicadas afectan DPO; notas borrador no se convierten en actividad emitida. Faltantes de calendario de pagos afectan forecast, no cambian DPO. El aging de este diagnóstico no utiliza programación como fecha contractual. Los detalles de historia pendiente se separan: tres meses comparables para DSO/DPO, población de saldo al corte para aging y ventana de consumo aún por aprobar para runway; no se convierte la propuesta de tres meses de burn en requisito implícito.

## Integración futura de lectura y UI

1. Incorporar el módulo sin conectar todavía los indicadores productivos. Asegurar que los guardrails del repo, build y pruebas integradas sigan pasando en la rama de integración.
2. Preparar lector con el cliente autenticado existente, organización explícita y RLS existente. No introducir service-role, SECURITY DEFINER, nuevos GRANT ni políticas permisivas. Un filtro de organización no demuestra por sí solo aislamiento integral; se requieren pruebas de las uniones/vistas existentes. No eludir un permiso denegado.
3. No ejecutar en navegador los SELECT de auditoría, `information_schema` o lecturas de bitácora sin una superficie existente autorizada. Este paquete no agrega RPC. Si los agregados no son accesibles con RLS actual, reportar el límite y proponer una capa de lectura separada y revisada, sin elevar acceso en este cambio.
4. Reutilizar la estrategia de lectura/paginación ya revisada en el proyecto y distinguir respuestas parciales, errores y listas vacías. No usar una página UI como población. No cambiar el servicio de paginación dentro de este paquete. La futura coherencia histórica exige un snapshot/corte sustentado por el lector; no basta una etiqueta en el cliente.
5. Usar las query keys centralizadas del feature y el flujo React Query existente, con organización, moneda, corte y mes en la identidad de caché. Cancelar/aislar respuestas al cambiar de organización; no conservar el diagnóstico anterior como si fuera el nuevo. Consultas bajo permisos reducidos deben dar N/D, no cero ni cifras cacheadas de otro tenant.
6. Mostrar “N/D” y una explicación corta por indicador, con detalle de todas las causas. Distinguir “cobertura observada” de “verificado”. Mostrar moneda, corte pedido, fechas reales de lectura y cobertura de contexto; no porcentajes de completitud inventados. El código `rows_with_statement_balance` debe presentarse como “campo saldo informado”, no “extracto conciliado”.
7. Mantener separadas etiquetas de cartera actual, aging contractual y programación. No reemplazar en este paso valores/productos existentes por el output de diagnóstico. El despliegue UI y el cambio de fórmulas requieren paquete posterior revisado y pruebas completas.

## Políticas pendientes y paso posterior

Las cinco recomendaciones siguen siendo propuestas para validación contable, no defaults:

1. Clasificación comercial al origen y principal/agente con evidencia y versión.
2. Asignación documental de base, impuestos y retenciones; recuperar bases faltantes. Prorrateo sólo si se aprueba explícitamente, sin tasa fija universal.
3. Primero moneda documental; consolidación y tipo de cambio histórico bajo criterio explícito. La falta de FX para otra moneda no invalida por sí sola el importe nominal en su moneda.
4. Ventana y clasificación de consumo de caja; separar operación, inversión, financiación y terceros, con tratamiento explícito de traspasos internos. No suponer que un lapso corto de movimientos equivale a un mes de consumo.
5. Caja disponible, restricciones y conciliación real al corte, con extractos y cobertura verificados.

Siguiente paquete después de estas decisiones: normalizadores/read-model y verificador con autoridad real, linaje de eventos/ajustes/NC, historia reconstruible o snapshots prospectivos, pruebas de permisos y coherencia, y conexión explícita al núcleo puro. Hasta entonces este adaptador seguirá N/D incluso si recibe strings que afirman que algo está aprobado.

### Qué bloquea cada siguiente paso

La integración de un diagnóstico de cobertura, sin cifras ni cambio de fórmulas, no necesita adoptar nuevas políticas contables. Necesita una superficie de lectura existente y autorizada, pruebas de RLS/caché y revisión de UI. Si esa superficie no existe, debe proponerse por separado; este paquete no añade permisos para resolverlo.

Para habilitar métricas numéricas conviene una sola validación agrupada. Propuesta para que el responsable contable revise, no decisión tomada:

| Decisión propuesta | Consecuencia si se aprueba | Si falta dato o no se aprueba |
| --- | --- | --- |
| Clasificar crédito/contado y principal/agente por contrato y documento, con responsable y versión | Se podrán definir poblaciones comerciales homogéneas, separando fondos de terceros y comisión según su naturaleza documentada | No usar PPD/días como sustituto; DSO/DPO y flujos afectados permanecen N/D |
| Aplicar base/impuestos/retenciones a partir de componentes documentales; dejar el prorrateo automático fuera de la primera versión | Se puede normalizar cada aplicación respaldada sin tasa fija; recuperar las NC incompletas desde su documento | Una base desconocida sigue bloqueando el indicador afectado; no inventar su desglose |
| Primera versión por moneda documental, sin consolidación automática; política de conversión intermoneda separada | Evita mezclar monedas y acota el alcance inicial; aún exige linaje válido de aplicaciones entre monedas | Los casos de aplicación intermoneda sin criterio/tasa validada siguen N/D |
| Para runway, proponer consumo neto de caja operativa en tres meses completos cerrados, con inversión/financiación/terceros separados | Define denominador y observación; los compromisos obligatorios no operativos siguen dentro del forecast cuando correspondan | No anualizar/mensualizar un puñado de días como historia suficiente ni usar pérdidas EERR |
| Caja disponible únicamente de cuentas y fondos incluidos explícitamente, con extracto y conciliación al corte y restricciones revisadas | Define la apertura verificable del forecast y numerador de runway | Marcas Conciliado, cuenta activa y campo saldo no habilitan números |

Consulta agrupada sugerida: «¿Apruebas estas cinco reglas para la primera versión, manteniendo N/D hasta que cada documento, aplicación y saldo tenga respaldo verificable? En particular, ¿confirmas tres meses completos para consumo operativo, salida por moneda sin consolidación y sin prorrateo fiscal automático inicial?»

La respuesta a esa consulta fijaría políticas, no certificaría datos existentes. Recuperar documentos, acordar un corte de cierre y verificar bancos/historia seguirían siendo requisitos de evidencia; ninguno se obtiene de una aprobación genérica del diseño.

## Verificación y entrega

Desde el directorio local `candidate` se ejecutan tests Vitest, TypeScript estricto y ESLint con la configuración real del repo. La evidencia de esta etapa se guarda aparte, junto con la revisión independiente y los manifiestos. Esas pruebas aisladas no equivalen a build/suite/guards de toda la app ni QA browser/DB, que no se ejecutan en este cambio.

`stage3-delta-manifest.json` / `stage3-delta.patch` contienen sólo nueve archivos nuevos de código/pruebas más este documento. `combined-manifest.json` / `combined.patch` contienen los quince archivos de etapa 1 sin cambios más los diez archivos nuevos. Ambos se anclan al commit base solicitado. El inventario vivo, SQL con UUIDs y respuestas remotas quedan fuera de todos los manifiestos Git. Ninguna publicación, migración, mutación DB ni despliegue forma parte de esta entrega.
