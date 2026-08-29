# Riesgos aceptados

Registro de riesgos conocidos que se decidieron aceptar (con su mitigación), para
que una auditoría futura no los reporte como hallazgos nuevos.

**Última revisión:** 2026-08-29 (v13.793.0). Cifras verificadas contra el estado
vivo del repo y de la base.

## RN-EC-4 · Rate limit por IP con `x-forwarded-for` (Ola 5, 2026-08)

**Riesgo.** Las Edge Functions derivan la identidad del cliente de la cabecera
`x-forwarded-for` para el bucket de rate limit (`ratelimit_buckets`). Esa
cabecera es falsificable por el llamador, así que un atacante puede rotar el
valor y obtener una cuota nueva por cada IP inventada.

**Por qué se acepta.**

- Existe además un tope **global** por función (no por IP), que acota el abuso
  agregado independientemente de la cabecera.
- Las funciones sensibles exigen sesión autenticada y validan tenant
  (`organization_id`), por lo que el rate limit por IP es defensa en profundidad,
  no el control principal.
- La alternativa (rate limit por `user_id` + tope global) ya está aplicada en las
  funciones de escritura financiera.

**Cuándo revisar.** Si se expone alguna función sin autenticación al público
(formularios web, tracking anónimo), ese endpoint debe pasar a un rate limit con
identidad no falsificable (token firmado o captcha) antes de publicarse.

## V-14 · `formatFechaEs` sigue en 39 call-sites (34 archivos)

Deprecado, congelado por ratchet (`formatfechaes-deprecado.test.ts`). Migración
progresiva a `formatFechaDia`; no bloquea release porque el comportamiento de
zona horaria ya es correcto (ancla a mediodía UTC).

## RN-1 · Topes de ratchet con holgura de 10

Los ratchets de deuda (iconos `h-4 w-4`, `toFixed`, `uppercase`, `select("*")`,
`formatFechaEs`) usan `DEUDA_CONGELADA + 10`. Se acepta que la deuda pueda
crecer hasta 10 usos entre limpiezas para no romper CI en PRs no relacionados;
el plan es bajar el tope cada trimestre.

## RN-2 · Buckets de storage sin tope de tamaño ni lista de MIME (O1.15)

Los 7 buckets (`documentos`, `facturas`, `cxp-inbox`, …) tienen
`file_size_limit` y `allowed_mime_types` en `null`.

**Por qué se acepta.** En Lovable Cloud la configuración de buckets no se
cambia por migración (`storage.buckets` está bloqueado) y la herramienta
disponible sólo alterna público/privado. La validación vive en el cliente
(`MAX_FILE_SIZE_MB`, `ALLOWED_MIME_TYPES`) y todos los buckets son privados con
RLS por tenant.

**Cuándo revisar.** Si la plataforma expone configuración de buckets, fijar
15 MB y la lista blanca de MIME (PDF/JPG/PNG/XLSX/DOCX/XML).

## RN-3 · 12 constraints en estado `NOT VALID` (O1.16)

Existen 12 restricciones creadas con `NOT VALID` (conteo vivo de
`pg_constraint.convalidated = false` al 2026-08-29): validan los datos nuevos pero
no los históricos.

**Por qué se acepta.** Validarlas requiere depurar datos previos a los candados
(embarques y facturas antiguos). El comportamiento a futuro ya está protegido.

**Cuándo revisar.** Antes de un `VALIDATE CONSTRAINT` masivo, correr la
auditoría de filas infractoras y limpiarlas por módulo.

## RN-4 · Diferencia cambiaria en cobranza (O2.7) — retirada

El plan de la Ola 2 contemplaba registrar la diferencia cambiaria del cobro de
cliente (`diferencia_cambiaria_mxn`) cuando el pago llega con un tipo de cambio
distinto al de la factura.

**Por qué se retira.** El canon vigente ya valúa cada pago con la cascada
CFDI > DOF de la fecha del pago > T/C del embarque, y el saldo se compara
siempre en la moneda de la factura. La "diferencia cambiaria" en pesos sería un
dato contable derivado, no un control operativo: hoy no lo consume ningún
reporte ni la póliza contable, y guardarlo crearía una segunda fuente de verdad
del mismo número. La decisión es calcularlo en el reporte cuando contabilidad lo
pida, no persistirlo.

**Cuándo revisar.** Si contabilidad exige la póliza de diferencia cambiaria por
cobro, se agrega como columna calculada del layout contable (no como columna de
`pagos_factura`).

## RN-5 · Bloqueo de usuarios legacy con rol financiero sólo en `user_roles` (Ola 8, H2)

Las 3 RPCs piloto de la Ola 8 (`registrar_pago_proveedor_lote`,
`registrar_pago_cliente_lote`, `eliminar_pago_proveedor`) autorizan por
membresía en la organización del documento (`organization_members`) y ya no
por el rol global en `user_roles`. Un usuario con rol financiero en
`user_roles` pero sin membresía equivalente (históricamente poblado por la
edge `user-management` o SQL manual) operaba antes y recibirá
`LC_LOTE_SIN_ROL` / `LC_COBRO_LOTE_SIN_ROL` / `LC_PAGO_SIN_PERMISO` tras el
deploy.

**Por qué se acepta.** La membresía es la fuente de verdad declarada (el
espejo canónico va membresía → `user_roles` vía
`_sync_user_roles_desde_membership`) y no se puede hacer backfill a ciegas sin
conocer la población real de producción: asignar orgs por inferencia podría
dar acceso a la organización equivocada.

**Mitigación.** Antes de CADA deploy que incluya
`20260827080020_ola8_replay_pilotos_rol_por_org.sql` (o su corrección
`20260827090060`), correr `scripts/db/predeploy_b6_roles_legacy.sql` contra
producción: 0 filas = luz verde; cada fila es un usuario a sanear (alta o
corrección de su membresía, o retiro del rol huérfano) ANTES del deploy.

**Cuándo revisar.** Cuando la query lleve dos releases consecutivos en 0
filas, el riesgo legacy se puede dar por saneado y esta entrada retirarse.
Además, queda el caso multi-org pre-existente: `current_user_org_id()` es la
primera membresía, así que un miembro de 2 orgs es rechazado por el guard de
org en documentos de su segunda organización (H2 del review 2026-08-27); si el
negocio adopta multi-org de verdad hay que resolver ese guard, no sólo el
rol.
