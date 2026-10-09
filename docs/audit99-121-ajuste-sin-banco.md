> Procedencia histórica: este documento fue recuperado del delta47 reconstruido sobre la pila46. Sus commits, resultados y dependencias describen aquella fuente, no pruebas actuales del candidato sobre main06b6de7. No acredita SQL remoto, CI, publicación ni GUI actuales. Para el estado vigente consulte `ajustes-no-monetarios-release47-plan.md`.

# AUD99/121: ajuste no monetario sin vínculo bancario

## Contrato

`pagos_proveedor.es_ajuste` es la clasificación persistida. El método de pago,
referencia y motivo libres no convierten un registro en ajuste. La clasificación
queda fijada al crear el registro: cambiarla posteriormente requeriría una
operación explícita y revisada, fuera de este cambio.

Un ajuste reduce saldo documental; no representa una salida de dinero ni un
candidato de conciliación. Las defensas son acumulativas:

- La lectura CxP incluye el flag y PagoFila lo entrega a ConciliacionPagoCell.
  El ajuste nunca monta el controlador de conciliación. No ofrece vínculo,
  desvínculo ni edición genérica de pago. Un vínculo histórico se presenta como
  incidencia por revisar, nunca como conciliación válida.
- El servicio de vínculo lee el flag vigente, bajo RLS, antes de consultar banco.
  Rechaza ajustes con `LC_MOVIMIENTO_AJUSTE_NO_MONETARIO`; una lectura ausente,
  fallida o sin clasificación booleana produce `LC_MOVIMIENTO_PAGO_NO_VERIFICABLE`.
- El sugeridor pago→banco verifica la misma clasificación persistida. El sentido
  banco→pago filtra `es_ajuste=false` antes de paginar y antes de contar candidatos.
  Por tanto, el ajuste no consume el cupo ni crea un match único o ambigüedad
  artificial en la auto-conciliación. El backend mantiene la defensa final.
- La migración forward protege los vínculos directos, la generación/regeneración
  y la tipificación. Preserva los controles previos de organización, rol, moneda,
  importe, sentido, anticipo e idempotencia.

## Invariantes de base de datos

La migración nueva `20261007024500_audit99_121_ajuste_sin_banco.sql` conserva las
firmas y ACL previas. `_asegurar_movimiento_pago_proveedor` sigue SECURITY INVOKER
bajo RLS; el wrapper de regeneración conserva su validación explícita de tenant y
rol antes del rechazo por ajuste.

- `es_ajuste` sólo se fija al INSERT. Cualquier cambio de valor posterior falla
  con `LC_PAGO_CLASIFICACION_INMUTABLE`, aun sin banco o en papelera. Reescribir el
  mismo valor, editar metadatos y la baja lógica conservan sus reglas previas.
- Un ajuste no puede incorporarse a un lote monetario al INSERT ni cambiar hacia
  otro lote. No se reescriben composiciones históricas. Un lote histórico que
  contiene ajustes tampoco acepta un vínculo bancario nuevo.
- INSERT, retarget y cambios financieros del vínculo siguen el assert canónico.
  Confirmar o restaurar asociaciones verifica sólo la tipificación mediante un
  trigger separado, sin extender los demás checks a pagos ordinarios.
- La clasificación inmutable evita write-skew sin escribir en el pago desde
  el banco ni introducir locks cruzados. La prueba de carreras abre dos sesiones
  financieras y las retiene en locks observados antes de liberarlas: cubre ambos
  órdenes de envío de sentencias, ajustes/ordinarios y READ COMMITTED/REPEATABLE READ.
  La compuerta no determina cuál sentencia ejecuta primero al liberar los locks.

### Aislamiento de los errores de dominio

La revisión independiente detectó y reprodujo una divulgación por error: el
trigger de activación devolvía el error de ajuste para un pago de otro tenant
antes de comprobar su organización. También INSERT podía leer el flag antes del
WITH CHECK de RLS si el payload enviaba una organización ajena.

El candidato corregido comprueba primero el ámbito efectivo del caller SQL en
ambas rutas. Dentro de SECURITY DEFINER se usa `current_setting('role')` y, si no
hay SET ROLE, `session_user`; no se confunde el owner elevado (`current_user`) ni
un claim JWT con el rol SQL privilegiado. PostgreSQL/service_role/supabase_admin
conservan sus vías internas. Para el resto, NEW.organization_id debe coincidir
con org_scope antes de consultar la clasificación. Luego se valida pertenencia
del pago/lote y de la composición histórica antes de emitir cualquier error de
ajuste. Una composición cruzada falla por organización, independientemente del
flag del miembro inaccesible.

La suite `audit99_121_ajuste_aislamiento.sql` verifica INSERT, UPDATE con estado,
activación/restauración sin cambios de origen, pagos/lotes ajenos y miembros
cruzados, además del control service_role y un claim de rol que no debe elevar
privilegios. Conserva la prueba roja reproducida por el revisor y agrega rollback
atómico multirregistro, UPSERT y asociaciones históricas en papelera.

La prueba concurrente es local y confirma fixtures sintéticos para que varias
sesiones los vean. Se ejecuta sólo contra una base desechable con
`NONCASH_TEST_LOCAL=1 PGPORT=55447 node scripts/db/test-noncash-bank-concurrency.mjs`.
No debe apuntarse a una base de usuario.

## Histórico y despliegue

No se reescribe el SQL histórico `20261007023000`, ni se aplica un backfill, ni se
borra o desvincula información preexistente. Las asociaciones históricas
inconsistentes deben inventariarse en sólo lectura y revisarse separadamente.
El test forward comprueba que las filas históricas se conservan. Para un
inventario previo al despliegue, consultar en sólo lectura `bbva_movimientos`
unido a `pagos_proveedor` por `pago_proveedor_id` y, por separado, por
`pago_proveedor_lote_id = pagos_proveedor.lote_id`, filtrando `es_ajuste=true` y
conservando también los campos `deleted_at` y `estado_conciliacion`. No reparar
ni ocultar esas asociaciones automáticamente.

El candidato se valida localmente sobre la fuente release47
`bf37676ca2ff857d5556b23f7904659aec128332`. Antes de publicar, su delta deberá
integrarse sobre el padre final de release46 y volver a validar ese head. Este
trabajo no actualiza el PR179, no crea un PR nuevo y no aplica SQL remoto.
Un resultado local no demuestra despliegue ni validación GUI publicada.

## Cobertura

Las pruebas nuevas reproducen la ruta de PagoFila, apertura/cierre/reapertura,
no-instanciación del controlador, rechazo del servicio, lecturas fallidas,
ambos sugeridores y auto-conciliación real. Los controles monetarios conservan
su comportamiento, aun con texto libre «Ajuste».

PostgreSQL aislado verifica DML directo, cambio de clasificación, regeneración,
roles/tenant, controles ordinarios y preservación de datos/ACL del forward.
Las pruebas y logs de la entrega local distinguen rojo, verde y etapas no
realizadas; CI y GUI del head publicado son gates posteriores.
