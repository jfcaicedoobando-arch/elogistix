# Sondeo OS mínimo, sólo lectura y pendiente de revisión

Dos archivos productivos nuevos: scripts/ci/probe-systemd-pilot-os.py y
.github/workflows/ci-systemd-os-profile-probe.yml. Un script stdlib, un job;
ninguna dependencia que instalar. No importa launcher, wrapper ni runtime.
V9 y los archivos del owner de entrada permanecen sellados e intactos.

El sondeo se ejecutará únicamente en una VM GitHub hosted Ubuntu 24.04 después
de revisión explícita. No se ejecutó como sondeo en Asus. Las pruebas locales
usan datos falsos y procesos propios que sólo escriben bytes sintéticos.

## Datos y contrato consultado

Entry V4 leído como datos y contrastado con manifest SHA256
606f86d21077fa93027b42612fda98adff33d8beb6fd7e08be6e94f976523862,
entry SHA256 85ce7561f5bcb4913bcb6a321e1f5a9d0fb4f842b249f35b78e91cbc921de98e.
V6 preparación OS añade herramientas; manifest
394f4632323e8df8359b0a2af1b8e84c3fcf9eb762fd437208405891f5d50a5a,
entry b302493a077ab9f8fc0bc17994cb047df91b773468fd27c2852245d5a13efb31.
No se importaron ni ejecutaron. Instrucciones AGENTS.md/.agents/skills ausentes
en los workspaces/handoffs consultados.

El JSON observa ImageOS/ImageVersion y contexto GitHub por allowlist, kernel,
arquitectura, Python real/flags/sys.path, versión binaria de systemd y Version
del manager mediante systemctl show de sólo lectura. El baseline de política
central se revisó para v255: otra versión se informa como divergencia, nunca
como equivalencia garantizada. cgroup2 debe estar montado en /sys/fs/cgroup y
exponer memory/pids. No se escribe ni configura cgroup alguno.

Inventario fijo de entry V4:

- /usr/bin/python3.12, /usr/lib/python3.12 y lib-dynload; /usr/lib/python312.zip
  debe estar ausente, incluso como symlink colgante.
- /usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2, libc.so.6 y libm.so.6.
- /usr/bin/dash, stat, getfattr, sha256sum, mkdir, find, sort, timeout, dd, env.
  V6 añade id, mkfifo, setpriv y rm. Sólo se observa metadata/hash/ejecutabilidad:
  el sondeo NO ejecuta esas herramientas mutadoras.
- Ancestros OS fijos, /dev/null y disponibilidad de APIs Linux/FD/proc que
  consume entry; no cierra FDs del host ni configura SIGCHLD.
- /etc/passwd, /etc/group, /etc/nsswitch.conf y /etc/sudoers; directorios
  /etc/sudoers.d, /etc/polkit-1/rules.d, /usr/share/polkit-1/rules.d,
  /etc/pam.d y /etc/security.

NSS se consulta en un hijo propio acotado sólo después de observar exactamente
passwd/group=files e initgroups ausente o files; el hijo vuelve a comprobarlo
antes de pwd/grp/getgrouplist. Una fuente divergente se registra y evita activar
NSS remoto. Los candidatos son cuentas existentes con UID/GID positivos,
nombre y shell admitidos por entry; se contrastan nombre/UID, grupo primario,
grupos efectivos y membresía nominal administrativa. La identidad del runner
conserva el número de grupos observado; superar128 marca truncación y UNKNOWN.
Se muestran home/shell y
grupos necesarios para la receta, sin password ni GECOS. nologin no demuestra
una cuenta no administrativa: account_authorization siempre REVIEW_REQUIRED.
No se selecciona una cuenta ni se emite aprobación por coincidencia de grupos.

Política legible: metadata, nombres y SHA256 de configuraciones permitidas,
sin texto de reglas, secretos ni hashes de contraseña. /etc/security sólo
permite la lista explícita SECURITY_CONFIGS y limits.d/*.conf; polkit sólo
*.rules; sudoers.d/pam.d sólo nombres sencillos dentro de su directorio OS.
Un archivo no permitido recibe metadata/UNKNOWN sin abrirlo para lectura.
shadow, gshadow, opasswd, credenciales, entornos completos y cmdline no se leen.
PermissionError, cierres incompletos, cambios y límites producen UNKNOWN;
sudoers ilegible no se transforma en política vacía. No se usa sudo -l.

## Clasificación y límites

SUPPORTED significa sólo compatibilidad de los hechos mínimos observados con
este perfil de sondeo. No certifica semántica de política, cuenta, cadena de
custodia, cierre transitivo de stdlib, pins aprobados, bootstrap ni piloto.
El cierre completo de stdlib/loader/dependencias y la aprobación de política
siguen fuera de este inventario acotado y requieren revisión posterior.

UNSUPPORTED_PROFILE indica divergencia concluyente, por ejemplo NSS distinto,
tool ausente/no ejecutable, otra plataforma/Python/systemd baseline, metadata
incompatible o falta de memory/pids. INCOMPLETE indica datos sin resolver,
incluida cualquier política requerida ilegible/no permitida. Si coinciden,
la divergencia tiene prioridad y el informe conserva también todos los gaps;
ningún fallo o límite produce un resultado favorable. Exit0 sólo para
SUPPORTED; los demás estados salen3 conservando el JSON para artifact.

Un origen monotónico: presupuesto global30s, operaciones/comandos2s dentro del
mismo presupuesto y reserva0.3s; stdout/stderr por comando65536B cada uno;
lecturas de texto65536B, archivo16MiB y acumulado32MiB; política128 entradas y
profundidad2; candidatos16, passwd128/grupos256; informe máximo256KiB. Se
conservan fallos/evidencia parcial y hashes de prefijos de comandos. Sólo se
mata/recolecta el hijo exacto del sondeo; no grupos/PIDs ajenos. Suspendido el
host o con I/O de kernel no interrumpible, estos controles no garantizan30s.
timeout-minutes del job es defensa adicional, no reemplaza el presupuesto.

## Propuesta del job y entradas pendientes

Entrega desactivada por if:false y un exit3 incondicional. Trigger propuesto:
create de una única rama nueva del coordinador, repo exacto
jfcaicedoobando-arch/elogistix y run_attempt=1. El checkout fija el SHA literal
de la fuente revisada R. El commit W contiene el job final con ese pin R y se
revisa por separado antes de crear la rama; no intenta incluir su propio SHA.
No
pull_request, pull_request_target, forks, schedule, push o secretos.
permissions contents:read; checkout por SHA con persist-credentials:false;
actions fijadas por commit; artifact conserva también los fallos.

Antes de activar faltan: nombre literal de rama nueva, SHA completo de fuente R
que contiene el script revisado, commit W del job final con pin R, revisión
explícita de todos los bytes/pins Actions y creación única autorizada de esa
rama apuntando a W. La autoridad que crea la ref verifica externamente el SHA W
aprobado y su delta; el job no autentica W ni esa aprobación. Sólo escritores
confiables del repo pueden publicar este job. Se conserva la separación R/W:
insertar W en su propio YAML crearía una autorreferencia de Git imposible.
Placeholders son nombres pendientes,
no hashes futuros fabricados. Retirar la definición tras la primera ejecución;
recrear la rama o cambiar YAML exige nueva revisión. Concurrency evita solape,
pero no es un cerrojo global de ejecución única contra un administrador.
Un job omitido o sin JSON significa NOT_EXECUTED/INCOMPLETE, nunca hechos OS.

[GitHub documenta create](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#create)
como evento de creación de ref; no requiere usar workflow_dispatch para una
definición aún ausente en main. No se propone bypass de dispatch.
[La imagen publicada](https://github.com/actions/runner-images) sólo orienta:
las versiones/pins de la VM se obtienen del sondeo real y Setup del job.

No publicar ni ejecutar esta propuesta ahora. No cambia CI5shards/2workers,
PR232/235, el piloto de memoria, benchmark5/8 ni políticas de acceso. No sudo,
instalaciones, cuentas/grupos nuevos, servicios ni cambios persistentes.
