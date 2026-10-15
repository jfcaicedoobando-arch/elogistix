# Lane PostgreSQL 17.6 de persistencia: plan pendiente

Estado al 2026-10-15: **NOT_RUN**. La lane específica de persistencia no está construida ni ejecutada. Este documento describe trabajo pendiente; no es un runner, una certificación del store ni evidencia de integración.

El ZIP autorizado es `Elogistix-persistencia-propuesta.zip`, Library `libfile_c84ef6930ee48191917bc2e235168fd8`, versión 0, SHA256 `45ec554f587cc3a12048732254ac98bd98f09ceaf18383dde496eba6c227dfa1`. El intake está bloqueado en el helper soportado de Library en Windows (`os.setxattr` no disponible). No hay `store.sql` materializado y verificado en este executor. Una ruta de otro executor no satisface este requisito. No se debe reconstruir el SQL a partir de descripciones ni sustituirlo por un fixture.

La demo debe permanecer deshabilitada: [AGENTS.md, línea 33](../../../AGENTS.md) exige cierre de UI, Edge antes de Auth/SQL y rutas SQL antes de DML. La configuración del wire real debe seguir vacía y su estado **UNBOUND**. Ninguna prueba descrita aquí autoriza habilitación, despliegue, migración remota, credenciales o grants/roles reales.

## Infraestructura disponible y límites de reutilización

Revisión del checkout base `5d1f00d27628100a58ab166367a067ea90068b84`. Se deben conservar sin cambios los archivos y la rama de CRM. Las referencias siguientes corresponden a ese commit.

| Fuente | Contrato aprovechable | Límite |
| --- | --- | --- |
| [run_ci.py:43-95](../../../scripts/ci/crm-acl-review/run_ci.py#L43) | `Runner(output, run_id)`, `save`, `command`, `docker`, `inside`, `query`; SQL por stdin, errores psql con SQLSTATE. | `command` usa `text=True`; no garantiza conservar bytes originales del SQL. |
| [run_ci.py:140-192](../../../scripts/ci/crm-acl-review/run_ci.py#L140) | `create_args`, `inspect_owned`, `start`; digest fijado, aislamiento comprobado e initdb/socket exclusivos. | Linux y Docker en runner de Actions; no existe modo local autorizado por su CLI. |
| [run_ci.py:234-291](../../../scripts/ci/crm-acl-review/run_ci.py#L234) | `CRMRunner.psql_args`, `session`, `release`, `finish_session`, `wait_lock`, `clone`; clientes persistentes registrados y dos conexiones independientes. | Roles y nombres de bases admitidos están ligados al fixture CRM; adaptar mediante una nueva subclase, sin ampliar el módulo original. |
| [adapter.py:6-23](../../../scripts/ci/crm-acl-review/adapter.py#L6) | Patrón de manifest con SHA256, archivos regulares, rechazo de symlinks y rutas fuera del árbol. | El manifest es de CRM. No valida el ZIP ni los archivos de persistencia. |
| [adapter.py:25-33](../../../scripts/ci/crm-acl-review/adapter.py#L25) y [run_ci.py:293-308](../../../scripts/ci/crm-acl-review/run_ci.py#L293) | Ejemplo de exportación de contrato sintético y contexto no superusuario. | `bind_candidate` cambia `$contract$` y `prepare` instala CRM. No ejecutar estas transformaciones sobre `store.sql`. |
| [concurrency_cases.py:81-132](../../../scripts/ci/crm-acl-review/concurrency_cases.py#L81) | Clones de fixture y observación de `pg_stat_activity`, `pg_locks`, `pg_blocking_pids`; falla si falta sincronización comprobada. | Las consultas de catálogo y las aserciones de ACL son específicas de CRM. |
| [concurrency_cases.py:171-238](../../../scripts/ci/crm-acl-review/concurrency_cases.py#L171) | Sesiones BEGIN/COMMIT/ROLLBACK y barreras por locks observados. | La barrera de event trigger sólo cubre REVOKE. No demuestra interleavings del store sin una adaptación revisada. |
| [concurrency_cases.py:653-703](../../../scripts/ci/crm-acl-review/concurrency_cases.py#L653) | Patrones de cancelación, pérdida de conexión, timeout y salida antes de COMMIT. | Las pruebas instrumentadas se etiquetan y no cuentan como compilación del candidato exacto. |

La nueva lane debe importar el runner fijado y especializar preparación, casos, snapshots y método de stdin binario en su propia carpeta. Debe tener su propio entry point y gate. No invocar `crm-acl-review/run_ci.py` con variables falsas ni alterar su gate: [run_ci.py:16-40 y 311-344](../../../scripts/ci/crm-acl-review/run_ci.py#L16) exige la rama CRM `fix/crm-helper-acl-review-20261015`, base antigua `70a55d4e29784fb1a78ed74f164473153bead704`, draft PR y checkout exacto; su matriz de 98 casos también es exclusiva de CRM.

Hashes SHA256 de los blobs Git canónicos del commit revisado, calculados mediante `git show HEAD:<ruta>`; no son hashes de los archivos CRLF del checkout Windows:

| Ruta | SHA256 del blob |
| --- | --- |
| `scripts/ci/crm-acl-review/run_ci.py` | `a364f833851080d9b290fca35fa7925514dc898979359e55c411f0eef57e7816` |
| `scripts/ci/crm-acl-review/adapter.py` | `aebe7c3a85ac6a371b5e207a8f5fc6119753915530eaff1990de679830d22ab5` |
| `scripts/ci/crm-acl-review/concurrency_cases.py` | `1a6e085ed88b3eaeac465680420293e7be82a827f011c9582ceab10326d7738a` |
| `.github/workflows/crm-helper-acl-review.yml` | `2b5fe6b4be24f0d19b2bcb5d9e22197b1b17f427c245ca305109f5ae9fde18e8` |

## Gates antes de cualquier Docker o SQL

1. Materialización local mediante Library, existencia/lectura efectiva, hash del ZIP fijado y verificación completa de `TRANSFER-SHA256SUMS`. Rechazar entradas faltantes, adicionales no declaradas, duplicadas, rutas absolutas/traversal, symlinks y hashes incorrectos. Con input ausente, registrar **NOT_RUN** y terminar antes de crear contenedores.
2. Revisar el store recibido y fijar explícitamente sus nombres, firmas, parámetros y bindings esperados. Actualmente no se conocen esas firmas; este documento no las inventa. Fijar hashes tanto del store como del issuer, owner y driver recibidos.
3. Gate independiente de Actions: evento `pull_request` de opened/synchronize/reopened, repositorio y ambos lados del PR `jfcaicedoobando-arch/elogistix`, owner esperado, base `main` con SHA revisado, rama propia de persistencia, draft obligatorio y `git rev-parse HEAD` igual al head SHA del evento. Si cambia la base, solicitar revisión del gate mediante código; no aceptar cualquier base dinámicamente.
4. Workflow dedicado con `contents: read`, checkout por SHA y `persist-credentials: false`, acciones fijadas por SHA, runner `ubuntu-24.04`, timeout y artifact `always()`. [Workflow CRM:1-35](../../../.github/workflows/crm-helper-acl-review.yml#L1) es el modelo. No reutilizar su filtro de rama para presentar la nueva lane como ejecutada.
5. El wrapper debe verificar que el runner importado conserva los hashes acordados y la política de aislamiento, y crear salida nueva dentro de `RUNNER_TEMP`. Nada de DSN, hosts, URL, secretos, imagen arbitraria, contenedor existente o modo producción. La entrada pública permite sólo referencias de fixture verificadas.

## Compilación de bytes exactos y adapter pendiente

`Path.read_text()` convierte terminaciones de línea y `subprocess.run(..., text=True)` codifica y puede traducir nuevas líneas. El runner CRM utiliza ambas rutas, por lo que no basta registrar el hash del archivo original y enviar una cadena reconstruida. El ZIP no debe ser normalizado ni modificado para adaptarlo al runner.

La adaptación posterior debe cumplir este contrato:

- Recibir sólo un `bytes` de `store.sql` validado por el intake y conservar `store_bytes_sha256`.
- Escribir el log `.sql` con `write_bytes` y enviar ese mismo objeto mediante stdin binario a `docker exec -i ... psql -X -w -v ON_ERROR_STOP=1 -v VERBOSITY=verbose`. El SQL no se introduce en argumentos de shell, interpolación, here-doc ni concatenación con fixture, SET o COMMIT.
- Heredar el entorno mínimo del runner; aceptar únicamente el contenedor propio validado, el socket fijo y una base/rol de fixture en allowlist. Capturar stdout/stderr binarios y decodificar únicamente para observación, conservando los originales y los hashes de entrada/log. Verificar igualdad del hash del log y del buffer enviado con el store verificado.
- Configurar contexto y crear fixture en llamadas previas separadas. Si el store exige bindings, prepararlos en el fixture según su contrato real y comprobar sus identidades/firma/ACL sin reescribir el store. Registrar qué dependencias son sintéticas. Si sólo puede compilar tras cambiar sus bytes, el caso de store exacto es **FAIL**, y cualquier variante instrumentada es un caso distinto.
- Registrar versión `170006`, rol `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`, no membresía en administrador y ausencia de escritura de catálogos, siguiendo [run_ci.py:295-297](../../../scripts/ci/crm-acl-review/run_ci.py#L295). Esas creaciones se permiten únicamente dentro del cluster desechable propio.

## Matriz runtime pendiente

Todos los casos siguientes tienen estado **NOT_RUN**. Cada caso requiere nombres y resultados concretos derivados del paquete verificado. Un éxito del harness offline no cambia estos estados.

| Caso pendiente | Evidencia mínima exigida |
| --- | --- |
| Store exacto y bindings | Hashes de bytes de entrada/log/stdin; compilación sin reescritura; catálogo de objetos creados, firmas y dependencias esperado. Error o binding ausente impide seguir. |
| Obligación lógica única | Dos intentos con identidad lógica equivalente y tokens/IDs de transporte distintos no crean dos obligaciones ni dos claims efectivos; comprobar la clave única real y el SQLSTATE contractual. El test debe fallar si sólo el token de transporte es único. |
| Bindings inválidos | Cambiar cada componente autorizado de tenant, contexto, identidad, versión o evidencia según contrato real causa rechazo antes del claim y antes de business fixture. No inferir un issuer o identidad reales. |
| Append-only | UPDATE, DELETE y TRUNCATE rechazados en transacciones independientes para las tablas protegidas y roles relevantes del fixture; conservar filas, índices, constraints, triggers y privilegios. No contar una transacción previamente abortada como prueba de rechazo. |
| Claim separado y duradero | ClaimTX obtiene respuesta y COMMIT confirmado; una segunda conexión independiente observa el claim antes de abrir businessTX. Registrar dos `pg_backend_pid()` distintos, orden y estado persistido. |
| Dos conexiones: claim ganador confirmado | Con A reteniendo el claim sin commit, B intenta la misma obligación; comprobar lock y bloqueo real, confirmar A y exigir que B no obtenga un segundo claim ni ejecute business fixture. |
| Dos conexiones: rollback previo al claim duradero | Hacer rollback de A antes de confirmar ClaimTX y caracterizar el resultado contractual de B, sin afirmar que ya existía un claim duradero. Comprobar estado final y ausencia de doble negocio. |
| Rollback posterior al claim | Tras ClaimTX confirmada, businessTX sintética falla o hace rollback. Otra conexión sigue viendo el claim y un nuevo intento se rechaza o entra en quarantine; no vuelve a ejecutar business fixture. |
| Interrupción posterior al claim | Cancelación, timeout, pérdida del cliente/backend y respuesta ambigua no habilitan retry/reconexión ni nueva businessTX. Evidencia de quarantine según el contrato recibido. |
| Poison y contextId | Preflight inválido no deja claim/quarantine persistente que bloquee un intento válido; un getter sintético de contextId que cambia entre lecturas prueba que sólo se consume una identidad. La relación con owner/driver debe probarse por separado del SQL. |
| Cleanup | Clientes propios reaped, PostgreSQL detenido, ausencia de postmaster.pid, contenedor detenido/removido y consulta posterior sin ese ID. Sin esta evidencia no emitir PASS. |

Una tabla/función de negocio de prueba debe llamarse y describirse explícitamente **sintética**. Su contador puede demostrar cuántas invocaciones hizo el harness; no certifica motor, issuer canónico real, autenticación ni identidad. Las barreras deben observar locks/actividad; un sleep no prueba orden. Toda modificación/instrumentación del candidato debe tener hash propio y `exact_candidate_bytes=false`.

La garantía buscada es **at-most-once con quarantine**. Dos RPC HTTP que envían un token reutilizable no prueban continuidad de conexión ni evitan por sí solos una duplicación downstream. Ni un PASS de esta lane ni `Postgres.js reserve` prueban una conexión física continua a través de un pooler. ReadyForQuery, socket epoch, conexión exclusiva y prohibición de retry/reconexión tras claim siguen siendo gates independientes del driver real.

## Aislamiento y cleanup heredables

Imagen fijada: `postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3`; afirmar `server_version_num=170006` en runtime. `--network none`, sin host binds, puertos, devices o volumes-from; rootfs read-only, usuario OS postgres, `cap-drop ALL`, no-new-privileges, CPU/memoria/PIDs limitados y sólo tmpfs admitidos. PostgreSQL escucha únicamente en el socket del contenedor propio, sin TCP: [run_ci.py:140-191](../../../scripts/ci/crm-acl-review/run_ci.py#L140).

`Runner.close_sessions` sólo reap clientes Popen registrados y preserva errores primarios; `cleanup` recupera un cid únicamente tras validar nombre, token, labels, imagen e aislamiento. Detiene el cluster, verifica `pg_ctl status=3` y ausencia de PID, detiene y elimina ese contenedor, y confirma su desaparición: [run_ci.py:97-129](../../../scripts/ci/crm-acl-review/run_ci.py#L97), [194-231](../../../scripts/ci/crm-acl-review/run_ci.py#L194). La transición a PASS requiere cleanup `confirmed_stopped_and_removed`: [342-344](../../../scripts/ci/crm-acl-review/run_ci.py#L342). El wrapper de persistencia debe conservar esos requisitos y fallar ante cleanup incompleto, incluso si todos los casos SQL pasan.

## Comprobaciones offline y resultado local

Comando oficial del harness existente, sin base de datos, ejecutable en un checkout Linux con bytes LF y Python disponible:

```sh
python3 -B -m unittest discover -s scripts/ci/crm-acl-review -p 'test_*.py' -v
```

Resultado de la primera ejecución local en este Windows: **FAIL**, 47 tests ejecutados, 43 pasaron, un FAIL y tres ERROR. `core.autocrlf=true` y `git ls-files --eol` mostraron `i/lf w/crlf` para los inputs afectados. `test_hashes` rechazó el hash de `inputs/SNAPSHOT_RACE_TEST.md`; `test_instrumentation_does_not_mutate_frozen_candidate` rechazó su ancla LF al recibir bytes CRLF. Dos tests de cleanup fallaron al crear `logs` en el directorio temporal redirigido por el sandbox (`WinError 5`), antes de cualquier Docker/SQL. En esa ejecución no se corrigieron ni normalizaron archivos CRM para obtener un PASS. Para nuevos tests, usar un directorio temporal explícito dentro del workspace autorizado. Una repetición con blobs Git LF restaurados exactamente debe registrarse por separado, sin cambiar el candidato de persistencia ni el ZIP.

Repetición por el agente integrador: **PASS**, 47 tests del harness CRM, usando los blobs Git LF exactos y un temporal explícito del workspace. Se restauró después el checkout sin diff en CRM. Este PASS sólo corresponde a pruebas offline de la infraestructura existente.

La revisión independiente del intake reprodujo un bypass de validación de nombre: `zipfile` conserva `ZipInfo.orig_filename='proposal/store.sql\0evil'` y expone `filename='proposal/store.sql'`. Validar sólo `filename` permitía una aceptación sintética con nombre truncado y manifest aparente completo. Se corrigió exigiendo igualdad entre ambos nombres y validación del original, con una regresión que modifica los headers ZIP en memoria. La revisión independiente de la corrección ejecutó **15 tests sintéticos PASS**, con temporal explícito dentro del workspace. El hallazgo afecta la robustez del validador; el pin público rechaza el ZIP sintético y el intake no extrae ni ejecuta sus miembros. Este PASS no verifica el paquete ausente ni la lane SQL, que sigue **NOT_RUN**.

Este resultado local no revoca ni sustituye evidencia anterior de Actions y tampoco aporta evidencia de integración nueva. Docker no está disponible por `Get-Command` en este executor. La materialización del paquete y la ejecución en un runner admitido permanecen bloqueantes; no se cambia de executor ni se inventa una conexión para resolverlos.
