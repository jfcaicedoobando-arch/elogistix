# H14: regresión estricta de integridad financiera

Pruebas sobre `e302a5a8baee295a5de83adc91265c87cbf45988` y una migración candidata explícita. Root coordina la ejecución en PostgreSQL local aislado; no se aplica SQL remoto. Los intentos y errores de preparación se conservan por separado de los resultados de regresión.

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
| Finanzas serial | B01/B02; L01-L05 con productor real; estados E01-E08; P01 muestra frente a conteo; P02 monedas/importes sin validar tasas reales; H01/H02/H04; vínculos CxP agregados |
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

## CI y laboratorio local

La lane debe ejecutarse después del replay completo y antes de `_ci_post_migrate.sql`, sin blanket grants ni relajación de FKs. Usa clones propios de la base estricta, captura invariantes del origen y destruye los clones al finalizar. No acepta URLs, rutas libpq heredadas ni un CID arbitrario.

Para el laboratorio local se preparará una copia del runner revisado con un overlay candidato de migración explícito, archivos enumerados y hashes. El preparador original permanece intacto. Root revisa el manifiesto y controla inicio y cleanup.

La evidencia distingue pruebas SQL/RLS de HTTP/JWT/UI. Los controles de nulabilidad E06 y guardas E08 se registran como restricciones de constructibilidad, sin forzar históricos inválidos ni contarlos como llamadas al RPC.

## Preparación y evidencia

La suite actual declara 51 casos financieros, 26 de autorización, 44 de escritores y 14 carreras. Los conteos exactos y hashes ejecutados se fijan en `runtime-contract.json`; el runner rechaza faltantes, duplicados y observaciones no confirmadas. La ejecución local usa además un manifiesto independiente de overlay/infra y un quinto clon sólo para el snapshot oficial de CI.

Los primeros intentos locales completaron replay e historia ficticia, y confirmaron Finance/Auth/Carreras. El lote de escritores detectó errores de sus constructores antes de emitir casos: etiqueta de categoría duplicada y edición de concepto tras emitir factura. Las correcciones se limitaron a los fixtures; las guardas del ERP permanecen activas. El estado terminal de cada ensayo, incluido cleanup, es la fuente de verdad del informe de ejecución.

## Resultado local y alcance pendiente

El ensayo local de root `c04c9938f0684246819ed79383e07a97` terminó con 135 observaciones completas, cuatro suites exit 0 y limpieza confirmada. Finanzas incluye 45 llamadas al RPC de baja (9 permitidas y 36 rechazos), cinco restricciones de constructibilidad E06/E08 y un agregado P03 de siete comparaciones de conjuntos. Los 44 casos de escritores incluyen seis restauraciones por `restore_record`, rutas directas, purga y rechazo de aislamientos no soportados. C14 comprueba la revocación durante una espera real del mutex.

El candidato conservó los datos ficticios previos al forward; los esquemas, datos del origen y roles permanecieron iguales durante las pruebas. Las secuencias están excluidas de la garantía de rollback. El quinto clon local se usa exclusivamente para generar el snapshot oficial posterior al arnés de CI.

La comparación de inventario OID de todas las funciones privadas `_h14_*` se añadió a A08 después de ese ensayo local, conservando sus 26 IDs y 56 comprobaciones de ACL. El head definitivo debe validar ese archivo y todos los hashes mediante la lane de Actions. La evidencia de CI se guarda en `reports/h14-integrity-ci/` y en el artifact `h14-integrity-<run_attempt>`.

Las observaciones SQL, RLS y SSR no certifican el recorrido HTTP/JWT firmado ni un despliegue. Los criterios de estados existentes se conservan; las decisiones de negocio adicionales se documentan aparte del éxito de la regresión.
