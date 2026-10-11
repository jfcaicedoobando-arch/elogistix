# Sonda de capacidad cgroup v2 de sólo lectura

Estado: propuesta local separada de PR232. No está publicada ni ejecutada en
Actions. No modifica el método 5 ni proporciona un fallback para completar
sus mediciones RSS.

La sonda busca comprobar si un runner `ubuntu-24.04` expone cgroup v2,
`memory.peak` legible y señales de delegación ya otorgada al proceso actual.
No crea cgroups, mueve procesos, activa controladores ni cambia permisos.
No usa sudo, instala componentes, inicia servicios o reinicia contadores.

El workflow propuesto se activa sólo al abrir un PR (`pull_request`, tipo
`opened`) dirigido a `main` que cambie alguno de estos cuatro archivos:
`.github/workflows/cgroup2-capability.yml`,
`scripts/ci/probe-cgroup2-capability.py`,
`tests/test_probe_cgroup2_capability.py` o este documento. El job exige además
que el repositorio de ejecución y el de la rama de origen sean exactamente
`jfcaicedoobando-arch/elogistix`, y que esa rama sea
`ci/probe-cgroup2-capability`. No se activa con pushes posteriores, reaperturas
ni `workflow_dispatch`. Permite una consulta inicial sin fusionar primero
el workflow en `main`; no usa `pull_request_target`.
Conserva el permiso `contents: read`, un job de hasta tres minutos y un step
de hasta un minuto.
Ejecuta `/usr/bin/python3 -I -B -` incluido en el runner: ignora configuración
ambiental de Python e importaciones locales y no genera bytecode en caché.
Es autocontenido: sin checkout,
actions externas, secretos, lectura de tokens o volcado de entorno. El
resultado JSON se escribe sólo en stdout para consultarlo en el log; no
requiere artifacts, outputs del workflow ni archivos en el repositorio.
No muta el filesystem ni cgroups; stdout y el transporte de la consulta al bus
son las comunicaciones propias de la sonda, no una promesa sobre las
operaciones internas del runner de Actions.
El payload inline reproduce exactamente
`scripts/ci/probe-cgroup2-capability.py`; su igualdad se verifica por bytes y
SHA256 al preparar el workflow. Cualquier cambio del script exige regenerar
y revisar esa copia antes de publicar la propuesta.

## Resultado y límites de la sonda

El contrato JSON es `schemaVersion: 1`, con estado `observed`, `partial` o
`unavailable`. Recoge sólo metadatos permitidos del kernel, sistema, Python e
imagen del runner, además del UID/EUID del propio proceso. ImageOS e
ImageVersion se consultan individualmente y se validan; no se recorre el
entorno. No publica rutas, nombres de cgroups, contenidos con PID/TID,
mensajes de error ni el valor de memory.peak.

Comprueba antes y después la pertenencia del proceso, mountinfo completo y
la identidad dev/inode del directorio de su cgroup, fijado mediante un
descriptor. Cambios, errores o plazos excedidos invalidan las observaciones.
Estas guardas no proporcionan un snapshot atómico de todos los permisos:
las condiciones de las interfaces pueden cambiar durante las lecturas.
Examina como máximo ocho grupos anónimos: el actual y hasta
siete ancestros visibles. Sólo consulta metadatos de directorio y archivos
de delegación (`cgroup.procs`, `cgroup.threads`, `cgroup.subtree_control`),
controladores y tipo. No lee las listas de procesos/hilos. El único xattr
consultado es `user.delegate`, con buffer fijo de dos bytes; una respuesta
más grande se registra como oversize. Sólo reconoce su marcador estricto `1`.
La presencia de ese marcador es evidencia de delegación marcada existente,
sin acreditar permisos efectivos ni aislamiento. Su ausencia no demuestra
que no exista una delegación otorgada por otro mecanismo.

`memoryPeak` indica existencia, estado de lectura y validez numérica; no
expone bytes ni un máximo utilizable como muestra. La consulta opcional al
user manager usa sólo el bus ya existente de `/run/user/EUID/bus` y la
pregunta fija NameHasOwner para `org.freedesktop.systemd1`, con
`busctl --auto-start=no --allow-interactive-authorization=no`.
No activa servicios, inicia un manager ni enumera
sus propiedades. Que el nombre tenga owner no demuestra delegación.

La sonda tiene un presupuesto de 20 segundos con SIGALRM; limita mountinfo a
128 KiB, las demás lecturas de archivos a 4 KiB, las rutas a 128 componentes y el recorrido
a ocho grupos. La consulta al bus tiene presupuesto de dos segundos,
incluido en el plazo global, y cleanup/reap acotado de 50 ms; acepta hasta
4.096 bytes de respuesta. Límites excedidos, lecturas truncadas,
pertenencia cambiante o respuestas inválidas se conservan como resultados
parciales/no disponibles, sin ampliar permisos ni instalar herramientas.
SIGALRM es una comprobación de presupuesto, complementada por los timeouts
del step y del job; no promete interrumpir absolutamente una llamada del
kernel bloqueada. El borrador local no certifica ejecución nativa Linux.

La evaluación siempre conserva `writeAuthority: not_tested`,
`isolation: not_established` y `delegation: not_established_read_only`.
`observed` significa que se observaron las capacidades expuestas, no que un
método de medición esté aprobado. Ningún estado autoriza mutaciones.

## Qué permite concluir

Leer `memory.peak` acredita disponibilidad de esa interfaz en el cgroup
visible. Aunque la sonda no publica su valor, éste puede incluir otros procesos que comparten ese cgroup,
actividad anterior a la sonda y consumo del propio intérprete Python.
Sin aislamiento y atribución verificados no
es el pico de Vitest, del comando actual ni de todo el runner. La sonda no
escribe en `memory.peak` ni intenta ponerlo a cero.
La interfaz incluye memoria del cgroup y sus descendientes, y su historial
depende de los resets efectuados mediante escritura y del descriptor usado;
esta sonda no realiza ninguno. Ver el [contrato de cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html).

Un resultado positivo de `W_OK` sólo expresa el permiso aparente que consulta
el proceso. No prueba que el kernel permitiría crear un hijo, trasladar un
proceso, habilitar un controlador o resetear un contador. Tampoco demuestra
propiedad exclusiva, delegación suficiente o aislamiento de una futura
medición. La lectura disponible y el permiso aparente son observaciones
distintas; ninguna convierte memoria desconocida en una muestra completa.
Un marcador `user.delegate` tampoco garantiza que los controladores pedidos
estén efectivamente disponibles. Ver [delegación en systemd](https://systemd.io/CGROUP_DELEGATION/).

Un resultado negativo o desconocido conserva la limitación encontrada.
No autoriza cambios de permisos, uso de sudo ni activación de controladores
para hacer pasar la sonda. Cualquier medición con un cgroup exclusivo sería
una propuesta posterior con su propio contrato y revisión.

## Revisión antes de ejecutar

Revisar juntos el script y su copia exacta en
`.github/workflows/cgroup2-capability.yml`, incluidos el contrato JSON y las
categorías cerradas de error. Esta propuesta no despacha el workflow ni
publica cambios. Una corrida futura sólo aportaría evidencia de capacidad
del runner observado; no aprobaría PR232 ni acreditaría un benchmark.
La disponibilidad real en el runner de Actions queda pendiente. La revisión
local de estructura y payload Python no equivale a una validación nativa de
GitHub YAML/actionlint ni certifica permisos o capacidades del runner.

Referencias del descubrimiento de montaje y consulta al bus:
[mountinfo de proc](https://docs.kernel.org/filesystems/proc.html) y
[busctl, incluidas las reglas de auto-start](https://raw.githubusercontent.com/systemd/systemd/main/man/busctl.xml).
