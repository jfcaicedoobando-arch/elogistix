# Contrato diagnóstico OS probe v1

Archivo: `scripts/ci/probe-systemd-pilot-os.py`.
Entrada CLI: `main() -> int`, sin argumentos para sondeo público.
Helper interno: `collect(probe: Probe) -> dict`; no es API del productor.
Salida: un solo objeto JSON UTF-8 en stdout, máximo256KiB más LF.
Workflow guarda stdout como `pilot-os-facts.json` y retiene artifact aun con
exit3. Exit0=SUPPORTED del perfil diagnóstico; exit3=UNSUPPORTED_PROFILE o
INCOMPLETE. No rerun favorable ni autoridad por exit0.

Todos los informes públicos contienen estos campos:

| Campo | Tipo/semántica |
| --- | --- |
| schema | literal `elogistix.systemd-pilot.os-probe.v1` |
| diagnostic_only | literal `true` |
| trusted_producer_input | literal `false` |
| account_authorization | literal `REVIEW_REQUIRED` |
| classification | `SUPPORTED`, `UNSUPPORTED_PROFILE`, `INCOMPLETE` |
| unsupported_evidence | lista[str], incompatibilidades concluyentes |
| unknown_evidence | lista[str], evidencia faltante; nunca equivale a política vacía |

Campos observados, presentes cuando alcanzados: image (allowlist de contexto e
ImageOS/ImageVersion), kernel, python, os_release, tools, ancestors, entry_paths,
startup_zip_absent (bool o `UNKNOWN`), linux_api_available, dev_null, proc,
systemd_binary, systemd_manager, cgroup2, policy_files, policy_directories, nss,
accounts, nss_command, elapsed_seconds, limits,
stdlib_transitive_closure_pins=`NOT_COLLECTED_BY_THIS_BOUNDED_PROBE`.
En fallo puede haber reason, partial_evidence=true y subconjunto de estos
campos. Su ausencia es UNKNOWN, nunca valor favorable por defecto.

Metadata de archivo: path, status (`OBSERVED`/`UNKNOWN`/`UNSUPPORTED_PROFILE`),
uid/gid/mode/size/dev/inode/nlink/symlink, forbidden_xattrs y sha256/bytes_read
si se pudieron observar; reason si falta. Ejecuciones: argv fijo, status,
returncode, stdout/stderr_bytes_retained, stdout/stderr_sha256_retained,
version_text/stderr_prefix para versiones; pending_own_child_pid sólo si cleanup
no se pudo confirmar. Digest del prefijo no significa digest de salida completa.
NSS: entries y matches_entry_profile. accounts contiene status y candidatos
acotados con name/uid/gid/home/shell/groups/group_names/administrative_groups,
uid_name_match y matches_group_profile. Son candidatos a revisión, jamás
cuentas seleccionadas, seguras o aprobadas. No hay password ni GECOS.

El modo `--nss-worker` pertenece sólo al helper propio acotado, usa el esquema
interno `elogistix.systemd-pilot.os-probe-nss.v1`; no es interfaz del productor.

## Frontera pre-run -> RunSpec

El productor NO importa este script, no consume su resultado como autorización,
no transforma UNKNOWN en listas vacías ni toma UID/pins/hashes del JSON como
aprobados automáticamente. El sondeo no produce RunIntent/RunSpec, approval,
origen monotónico t0 ni deadlines del piloto. elapsed_seconds describe sólo el
sondeo independiente. No hay garantías temporales contra suspensión/kernel I/O.

En la MISMA VM confiable, antes del único t0, deben observarse/revalidarse de
nuevo: imagen/OS/toolchain y bytes/hashes concretos; intérprete/startup/cierres
transitivos, ancestros/inodes/ACL/capabilities; NSS/UID-nombre/grupo primario,
grupos y canales administrativos con política completa legible desde el
contexto autorizado; PID1/systemd/cgroup2; ingreso/ELF/fuentes aprobadas y
custodia. Las partes que requieren contexto privilegiado quedan UNKNOWN aquí.
Su lectura posterior corresponde al ejecutor confiable ya revisado, no a una
escalación automática del sondeo. Sólo el productor existente de central toma
su única lectura monotónica para RunSpec, bajo su contrato original.

SUPPORTED describe compatibilidad del inventario mínimo observado, no aprueba
semántica de política ni cierre OS. Mismatch conocido tiene prioridad sobre
UNKNOWN, conservando ambas listas. No ejecutar/publicar antes de revisar todos
los bytes y gates del único job Ubuntu24 GitHub.
