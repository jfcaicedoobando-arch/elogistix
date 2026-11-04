# H14: regresión estricta de integridad financiera

Pruebas sobre `e302a5a8baee295a5de83adc91265c87cbf45988`, la migración H14 original y un forward explícito de rendimiento. Ambos archivos se fijan por ruta y hash; el collector corregido se verifica antes de clonar las cuatro suites. Root coordina la ejecución en PostgreSQL local aislado; no se aplica SQL remoto. Los intentos y errores de preparación se conservan por separado de los resultados de regresión.

Los fixtures se derivan del ensayo aislado final `b76cfcbabad044f8b1c26a4717292c25`. Las expectativas históricas de caracterización se retiraron: la regresión expresa el contrato autorizado para conservar historia financiera y bloquear relaciones activas. Los originales de `/workspace/audits/h14-fixtures/` permanecen intactos.

## Contrato de prueba

- Fixtures owner estrictos con `auth.users` ficticios y `skip_auto_org=true`; las membresías usan los triggers reales. No reparar espejos ni conceder permisos para hacer pasar la suite.
- Operaciones probadas bajo `current_user=authenticated`, UID y empresa comprobados; `super_admin=false` salvo controles de plataforma explícitos.
- `diagnosticar_baja_embarque(uuid)` devuelve versión 1, todas las categorías y muestras de folios separadas de conteos completos. Sólo puede leer un objetivo visible en la empresa activa con capacidad de baja.
- El mutador conserva su autorización previa, incluido Super Admin global. Rechaza contexto NULL y aislamiento distinto de READ COMMITTED antes de DML.
- Los vínculos vivos estructurales, incluso de importe cero, se protegen. Las reglas de estado existentes se conservan; no se elige una política nueva para documentos cancelados o puentes inactivos.
- Rechazos financieros conservan snapshots completos A/B y otras operaciones de A. Bajas permitidas preservan IDs y sólo producen los efectos operativos y bitácora autorizados.
- Cada caso emite un JSON antes de la aserción final. Un error de fixture, NOT NULL, FK o permiso incidental no cuenta como bloqueo financiero correcto.

## Lotes previstos

| Lote | Casos |
|---|---|
| Finanzas serial | B01/B02; L01-L05 con productor real; estados E01-E08; P01 muestra frente a conteo; P02 purga ante historia financiera previa; H01/H02/H04; vínculos CxP agregados; R01-R03 restauración histórica y atomicidad |
| Diagnóstico | Mismo conjunto y conteos que HINT de rechazo, categorías cerrada/comisión, muestras máximas 20, conteos completos, deduplicación de un documento por múltiples caminos, sin DML |
| Autorización | A01-A07, A05 ahora rechazo explícito; diagnóstico sin filtración cross-org, lector de otra empresa, anon/sin UID, ACL de helpers privados, búsqueda segura y Super Admin fuera de empresa activa |
| Escritores | INSERT, restaurar, mover FK y activar vínculo contra embarque borrado; documentos vivos/cancelados según contrato conservado; mismo tenant y control de otro tenant |
| Concurrencia | writer primero COMMIT/ROLLBACK; deleter primero con barrera natural; dos writers mismo padre; dos padres en orden contrario; snapshots RR/SERIALIZABLE; repetición en clones nuevos |

## Orden y evidencia de carreras

Se usará el protocolo de sesiones y marcadores probado en H14, conservando ON_ERROR_STOP. No se deduce el orden por `deleted_at` ni por sleeps. Se observan PID, `pg_blocking_pids`, locks de fila/relación y confirmaciones COMMIT/ROLLBACK.

1. Writer primero: su INSERT retiene el lock del padre; el RPC debe esperar. COMMIT del writer exige rechazo financiero; ROLLBACK permite la baja limpia.
2. Deleter primero: una sesión retiene la fila de `conceptos_venta`; el RPC adquiere el lock del embarque y espera en esa fila. El writer debe rechazar con `55P03` antes de crear un vínculo. Tras completar la baja, un intento nuevo debe rechazar el embarque borrado.
3. Dos writers del mismo padre: el segundo debe rechazar por NOWAIT; no se acepta un deadlock como cumplimiento de la regla.
4. Writer con snapshot REPEATABLE READ fijado antes de la baja: después del COMMIT del deleter debe rechazar o fallar por serialización, nunca crear una dependencia viva en el padre borrado.
5. El RPC de baja en REPEATABLE READ o SERIALIZABLE debe fallar antes de DML y conservar snapshots.

El protocolo revisado usa un mutex advisory de transacción por organización antes de resolver el grafo; el mutador espera y los escritores usan intento inmediato con `55P03`. Después se protegen los padres mediante locks de fila. La suite prueba el orden observable y los resultados, incluyendo un grafo inicialmente vacío y la revocación durante la espera; no deduce el orden por timestamps transaccionales.

La prueba bancaria existente se adapta a esa respuesta de contención: A conserva un cobro sin confirmar, B debe rechazar exactamente con `55P03 / LC_EMBARQUE_EN_USO` y no persistir efectos. Tras confirmar A, B reintenta en una transacción nueva con la misma llave y debe recuperar los mismos identificadores, un solo cobro y un solo abono. La misma llave con otro importe debe seguir rechazándose. Una variante de QA pausa B antes de la guarda H14 para ejercitar además el rescate de `unique_violation` del RPC; esa barrera es instrumentación de prueba, no una espera prometida en producción. Ninguna guarda financiera se desactiva en estas variantes. La prueba de factura manual conserva su barrera de idempotencia anterior al INSERT.

## CI y laboratorio local

La lane debe ejecutarse después del replay completo y antes de `_ci_post_migrate.sql`, sin blanket grants ni relajación de FKs. Usa clones propios de la base estricta, captura invariantes del origen y destruye los clones al finalizar. No acepta URLs, rutas libpq heredadas ni un CID arbitrario.

Para el laboratorio local se preparará una copia del runner revisado con un overlay candidato de migración explícito, archivos enumerados y hashes. El preparador original permanece intacto. Root revisa el manifiesto y controla inicio y cleanup.

La evidencia distingue pruebas SQL/RLS de HTTP/JWT/UI. Los controles de nulabilidad E06 y guardas E08 se registran como restricciones de constructibilidad, sin forzar históricos inválidos ni contarlos como llamadas al RPC.

## Preparación y evidencia

La suite actual declara 56 casos financieros, 26 de autorización, 44 de escritores y 16 carreras: 142 en total. Conserva los 140 IDs anteriores y añade `P04.reader_budget_empty` y `P04.reader_budget_shared`. Los conteos exactos y hashes ejecutados se fijan en `runtime-contract.json`; el runner rechaza faltantes, duplicados y observaciones no confirmadas. La ejecución local usa además un manifiesto independiente de overlay/infra y un quinto clon para el snapshot oficial de CI y, después, ocho regresiones existentes con el arnés de CI.

Los dos casos P04 llaman al lector público con un actor `authenticated` y empresa activa comprobados. Preparan una operación sin vínculos y otra con varios caminos a una misma factura; añaden 501 proformas terminales y 326 facturas de otra empresa ficticia, sin crear relaciones con las proformas canceladas. Con JIT desactivado, cada caso ejecuta dos lecturas bajo un plan custom y dos bajo uno generic. `statement_timeout='8s'` se configura antes de esos SELECT; el límite incluye cada llamada completa. Se comprueban el contrato, los ocho conteos independientes, la deduplicación, la igualdad entre las cuatro respuestas y las huellas de historia financiera antes y después. Todo el fixture se revierte. La evidencia es SQL local, sin una afirmación de autenticación HTTP/JWT ni de latencia productiva.

El include y el archivo de P04 están congelados en el contrato. Su omisión produce dos IDs ausentes y falla CI; un timeout o un resultado distinto aborta la suite. El forward no sustituye ni vuelve a escribir la migración H14 original. El runner verifica el nuevo cuerpo del collector y conserva su OID, ACL, propietario, contexto y argumentos.

Los guards del forward comprueban la preimagen y la postimagen; no constituyen un bloqueo de DDL concurrente. Su aplicación remota requiere una ventana de despliegue serializada, conforme al runbook revisado. Este arnés sólo lo ejecuta en la base efímera propia de Actions.

Los fixtures históricos que ya no se pueden crear con las nuevas guardas se preparan de forma explícita como propietario SQL y dentro de rollback. Comprueban primero el rechazo de la guarda activa, aíslan únicamente el trigger nombrado y lo reactivan y verifican antes de llamar a la RPC como el actor original. Los episodios de baja usan `now()`, como la guarda existente. El bloque de guards de CI se ejecuta secuencialmente para no solapar sus locks de DDL en una base compartida.

## Resultado local y alcance pendiente

El ensayo local histórico `9c7e839d1d704343bf44e2a978ed510f` terminó con 140 observaciones completas, cuatro suites exit 0 y ocho regresiones existentes aprobadas, incluida la de reportes con sus comprobaciones T1–T8 y controles intactos. Ese resultado no incluye los dos casos P04 añadidos después; su validación se registra en la evidencia del head que los ejecute. Finanzas incluye 45 llamadas al RPC de baja (9 permitidas y 36 rechazos), cinco restricciones de constructibilidad E06/E08, un agregado P03 de siete comparaciones de conjuntos y tres casos de restauración histórica. Los 44 casos de escritores incluyen seis restauraciones por `restore_record`, rutas directas, purga y rechazo de aislamientos no soportados. C14 comprueba revocación durante la espera de baja; C15 hace lo mismo para restauración y C16 comprueba restauración confirmada antes del rechazo de una baja concurrente.

El candidato conservó los datos ficticios previos al forward; los esquemas, datos del origen y roles permanecieron iguales durante las pruebas. Las secuencias están excluidas de la garantía de rollback. El quinto clon produjo el snapshot oficial posterior al arnés de CI; sus ocho regresiones posteriores conservaron esquema y datos. Se confirmó la eliminación del contenedor y su ausencia por CID y etiqueta de ejecución.

A08 incluye el inventario OID exacto de los 14 helpers privados y 56 comprobaciones de ejecución denegada. El head definitivo debe validar todos los hashes mediante la lane de Actions. La evidencia de CI se guarda en `reports/h14-integrity-ci/` y en el artifact `h14-integrity-<run_attempt>`.

Las observaciones SQL, RLS y SSR no certifican el recorrido HTTP/JWT firmado ni un despliegue. Los criterios de estados existentes se conservan; las decisiones de negocio adicionales se documentan aparte del éxito de la regresión.
