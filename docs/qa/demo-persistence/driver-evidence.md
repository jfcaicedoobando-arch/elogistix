# Driver de persistencia: evidencia y gates pendientes

Fecha de revisión: 2026-10-15. Base del checkout:
`5d1f00d27628100a58ab166367a067ea90068b84`.

**Estado: wire UNBOUND; endpoint cerrado; configuración operativa ausente.**
Esta investigación no instala un driver, no abre conexiones y no habilita la
demo. La semántica requerida es **at-most-once con quarantine**: puede conservar
un claim sin ejecutar o confirmar el negocio. No garantiza exactly-once ni
disponibilidad después de una respuesta ambigua.

## Alcance y procedencia

Se leyó `AGENTS.md`; no existe `.agents` en este checkout. Se inspeccionaron el
lockfile, la entrada HTTP y fuentes primarias públicas mediante la herramienta
de consulta web, sin navegador interactivo. No se leyeron valores de secretos,
archivos de entorno ni configuraciones de conexión.

El flujo histórico de Library no produjo el ZIP por un fallo `os.setxattr`;
ese ZIP y su `TRANSFER-SHA256SUMS` siguen sin verificarse. Posteriormente se
autorizó un contrato independiente de fuentes Git originales en
`860ac59cc9b6d80887c1a7811e2c81ef8ef17ca8`. Sus doce archivos y once checksums
se verifican por separado para la lane SQL. Esa entrada no materializa el ZIP
ni satisface los gates de un wire físico o una infraestructura real.

## Fuente exacta del candidato existente

`package.json` declara `postgres: ^3.4.9` como dependencia de desarrollo.
`bun.lock` resuelve exactamente `postgres@3.4.9`, con integridad:

```text
sha512-GD3qdB0x1z9xgFI6cdRD6xu2Sp2WCOEoe3mtnyB5Ee0XrrL5Pe+e4CCnJrRMnL1zYtRDZmQQVbvOttLnKDLnaw==
```

La [release upstream v3.4.9](https://github.com/porsager/postgres/releases/tag/v3.4.9)
enlaza el commit
[`e7dfa14519f363229ccc3ead7b1b2f2051937efb`](https://github.com/porsager/postgres/commit/e7dfa14519f363229ccc3ead7b1b2f2051937efb).
Se consultaron fuentes de ese commit. No se descargó ni verificó un tarball
contra la integridad del lockfile. El intento read-only de resolver el tag con
`git ls-remote` falló con `getaddrinfo() thread failed to start`; no hubo clone
local ni hash local de una dependencia. El SHA anterior procede del enlace de
la release, no de una descarga ejecutada en este entorno.

### Qué demuestra el código

En [`src/index.js`](https://github.com/porsager/postgres/blob/e7dfa14519f363229ccc3ead7b1b2f2051937efb/src/index.js),
`reserve()` toma un objeto de conexión y dirige consultas a él hasta `release()`.
`onclose()` lo devuelve a `closed`, borra la reserva y puede conectar una consulta
pendiente. Reservar ese objeto no demuestra que el transporte permanezca vivo.
La [documentación del driver](https://github.com/porsager/postgres/blob/v3.4.9/README.md#reserving-connections)
describe la reserva dentro del pool cliente, no una garantía del backend de un
pooler externo.

En [`src/connection.js`](https://raw.githubusercontent.com/porsager/postgres/e7dfa14519f363229ccc3ead7b1b2f2051937efb/src/connection.js):

- `ReadyForQuery()` resuelve consultas ordinarias después de procesar el mensaje;
  el indicador de transacción queda en el parser interno.
- `id` pertenece al objeto `Connection`, mientras `closed()` borra `socket` y
  `connect()` puede crearlo otra vez. Ese identificador no es un socket epoch.
- `execute()` llama `write(toBuffer(q))` antes de `q.options.onexecute`.
  Ese hook no permite impedir el primer envío.
- `ReadyForQuery()` puede llamar `retry()` para una consulta preparada cuyo
  error tenga una rutina de `retryRoutines`; `retry()` vuelve a ejecutar la
  consulta. `prepare:false` elimina esa condición específica, sin demostrar
  una política completa contra reconexiones o reenvíos.
- `backoff` controla demora de reconexión. `backoff:false` no constituye un
  interruptor que prohíba reconectar.

Los [tipos públicos](https://github.com/porsager/postgres/blob/e7dfa14519f363229ccc3ead7b1b2f2051937efb/types/index.d.ts)
exponen `reserve`, `release` y `onclose(connId)`, pero no un evento público
ReadyForQuery con estado y época física. El `state` de resultados contiene
información de cancelación; no debe registrarse ni confundirse con una prueba
de continuidad. Esta inspección corresponde a la fuente Node del candidato;
el import, build y runtime finales del eventual owner siguen sin fijarse.

### Límite del protocolo y del pooler

[PostgreSQL 17: Message Flow](https://www.postgresql.org/docs/17/protocol-flow.html)
sitúa ReadyForQuery al terminar un ciclo, también después de errores. Por ello
ReadyForQuery por sí solo no prueba que COMMIT haya tenido éxito.
[Message Formats](https://www.postgresql.org/docs/17/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-READYFORQUERY)
define los estados `I` (idle), `T` (transacción abierta) y `E` (transacción
fallida). La futura evidencia deberá asociar el resultado correcto de COMMIT
y ReadyForQuery `I` al mismo ciclo y transporte.

[PgBouncer: Features](https://www.pgbouncer.org/features.html) documenta que el
modo transaction devuelve la conexión de servidor al pool al finalizar cada
transacción; el modo session la asigna mientras dura la conexión cliente.
**Inferencia para este diseño:** entre claimTX y businessTX, un socket cliente
reservado puede seguir conectado al pooler y recibir otro backend en modo
transaction. Una época del socket cliente, `max:1`, `reserve()` o una comparación
puntual de PID no prueban la continuidad física exigida de extremo a extremo.
No hay evidencia aquí de que la infraestructura existente use PgBouncer ni de
cuál sea su modo; la fuente explica el riesgo, no certifica una topología real.

## Contrato a exigir al futuro binding

Estas son condiciones propuestas para revisión, no capacidades implementadas:

1. Preflight valida input y autorización antes de consumir la obligación; captura
   una sola vez el contexto inmutable. Falta contrastarlo con el paquete exacto.
2. El owner toma uso exclusivo de un transporte comprobable y serializa los
   ciclos; no hay consultas de negocio en cola ni pipeline que pueda adelantarse
   al resultado del claim.
3. ClaimTX se confirma por separado. El owner exige el resultado de COMMIT y
   ReadyForQuery `I`, ambos vinculados a la misma época y sin ErrorResponse.
4. Antes de entregar bytes de businessTX al transporte, una barrera atómica
   consume la única autorización de envío. No basta comprobar un booleano antes
   de llamar a una API que mantiene colas, retries o conexiones internas.
5. Desde el intento de claim no se permite retry ni reconexión para completar
   ese intento. Cierre, timeout, sustitución de socket o respuesta ambigua
   invalidan permanentemente la capacidad. Si no puede establecerse el resultado
   del claim, se conserva la incertidumbre para reconciliación; no se reenvía.
6. Tras claim confirmado, sólo hay una businessTX. Un rollback posterior no
   elimina el claim duradero. Una respuesta de negocio perdida lleva a
   quarantine y revisión; no se interpreta como permiso para repetir.
7. La identidad de obligación lógica y su unicidad viven en el store y owner
   revisados. Un token reutilizable enviado a dos RPC HTTP independientes no
   impide duplicación downstream. No se conecta ese patrón a la demo.

Una adaptación de Postgres.js sólo sería candidata después de instrumentar y
probar la época, el parser y la barrera **antes de escribir**, con una política
de cierre terminal. La API pública `reserve()` aislada no cierra estos gates.
No se entrega ni se recomienda desplegar un parche sin esa evidencia.

## Evidencia que debe aportar infraestructura al coordinador

Solicitar artefactos saneados, no credenciales, DSN ni lecturas de secretos:

| Gate | Evidencia faltante |
| --- | --- |
| Topología y afinidad | Diagrama y atestación del camino real: conexión directa o productos/versiones de cada proxy/pooler; modo efectivo por base/rol; posibles overrides; dónde termina TLS; reglas de failover y reciclado. Debe demostrar afinidad de backend entre las dos transacciones o rechazar esa ruta. |
| Runtime e import | Runtime y versión aprobados para el owner, origen/import exacto, digest o hash del build y permisos de sockets. El devDependency Node existente no acredita un driver operativo en Edge/Deno. |
| Transporte exclusivo | Contrato verificable de propiedad exclusiva desde preflight hasta cierre del intento; origen y monotonicidad del epoch; tratamiento de TLS/reemplazos; evento ReadyForQuery correlacionado; barrera previa a cualquier escritura de negocio. |
| Reenvíos de todas las capas | Política documentada del driver, aplicación, invocador HTTP, colas y proxies. Debe prohibir retries automáticos del intento consumido, incluso ante timeout, cancelación, desconexión o failover. |
| Durabilidad | Política de commit/WAL, almacenamiento y failover que sustente conservar el claim reconocido; comportamiento ante réplica atrasada o pérdida del nodo. Un COMMIT local no acredita por sí solo durabilidad en otra topología. |
| Autoridad y bindings | ZIP legible con hash y manifest verificados; issuer/owner reales revisados; esquema y ACL esperados; definición canónica de obligación y contexto. Las fixtures sintéticas no certifican motor, issuer ni identidad real. |
| Ensayo aislado | Evidencia reproducible sin red ni secretos de corte antes/después del claim y de cada frontera de envío/COMMIT, sustitución de socket, mensajes parciales, error de consulta preparada y dos contendientes. Contadores de envíos deben probar como máximo uno y quarantine cuando corresponda. |

No se pide crear roles/grants reales, acceso persistente ni activar una conexión.
Si esta evidencia no existe, el resultado correcto permanece UNBOUND.

## Resultados de esta investigación

| Comprobación | Estado | Alcance |
| --- | --- | --- |
| Base, instrucciones y lockfile inspeccionados | PASS | Checkout indicado; `.agents` ausente. |
| Fuente primaria del driver y semántica de protocolo consultadas | PASS | Investigación estática con SHA upstream; sin tarball local verificado. |
| `reserve()` suficiente para los gates exigidos | FAIL | No prueba epoch, barrera previa al envío ni afinidad a través del pooler. |
| Materialización y hashes del ZIP revalidados | NOT_RUN | Fallo histórico independiente de la entrada Git. |
| Driver instrumentado y pruebas de fallos del transporte | NOT_RUN | No hay binding implementado ni infraestructura acreditada. |
| Continuidad física, issuer, identidad y durabilidad reales | NOT_RUN | No se accedió a infraestructura real. |
| Lane SQL con fuentes Git originales | PASS sintético | 56 checks en Actions 38806953890; artefacto y cleanup inspeccionados por separado. |
| Certificación de motor, issuer e identidad reales | NOT_RUN | La lane sólo usa datos y negocio sintéticos. |
| Configuración y endpoint | PASS | No se añadió configuración ni se cambió `demo-access/index.ts`; continúa omitiendo proveedor y credenciales. |

La entrega es un documento de evidencia y bloqueo. No eleva a PASS los tests
reportados anteriormente ni convierte el protocolo propuesto en implementación
operativa.
