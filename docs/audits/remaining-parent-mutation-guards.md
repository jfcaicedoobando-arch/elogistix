# Padres activos en recálculo de factura y actualización TC

Base integrada de revisión: PR313 `3e651b466f9254a5309531fcb1bb67b0c84d43d6`, árbol `3785f8f8805d4b936bcfd45933f3aa3247153b2a` de `jfcaicedoobando-arch/elogistix`.
Overlay de la segunda corrección, preservando el forward de hijos NC/REP/sustitución y su hash `3c4be5f97b8145dd78c5aa96750e10b5d779407b6ed95862c6e74232ab59ec08`. No se ejecutó base remota, migración compartida, despliegue ni operación fiscal.

## Cambio acotado

- `recalc_factura_totales(uuid)` mantiene SECURITY INVOKER. Antes de consultar conceptos bloquea la factura no eliminada con `FOR NO KEY UPDATE`. Si no hay padre disponible conserva una salida sin modificación; los dos UPDATE finales también exigen `deleted_at IS NULL`. No cambia estados admitidos, conceptos seleccionados, cálculo por línea, tasas, retenciones ni fórmulas. La ausencia de conceptos vivos sigue dejando totales cero solamente en un padre activo.
- `actualizar_tc_embarque_dof(uuid,date)` mantiene SECURITY DEFINER, `_assert_writer`, la validación de Cerrado/Cancelado, selección DOF, fallback EUR y respuesta JSON. La selección inicial exige padre no eliminado y lo bloquea antes de permisos, estado y DOF; el UPDATE también exige padre activo. Padre eliminado devuelve el mismo P0002 de padre no encontrado. Una eliminación, cierre o cancelación concurrente ya no puede adelantarse durante cálculo/validación y dejar una escritura basada en el estado anterior.

No se cambia `_assert_writer` ni la excepción existente de super_admin entre organizaciones. `admin_org` sigue excluido por esa función; no se ha añadido un rol que el helper anterior no admitía. No se cambia RLS, ACL, roles, consultas históricas, backfill, triggers de otros flujos, migraciones antiguas ni seguridad del entorno.

## Forward y conservación

`20261013151000_padres_activos_recalculo_tc.sql` es transaccional. Exige funciones existentes, SECURITY/search_path esperados y cuerpo exacto de fuente, espejo revisado o reaplicación. No usa normalización ni aceptación de un cuerpo desconocido. TC conserva en el squash la misma variante que el espejo; recalc es reemplazado posteriormente por la migración audit26, antes de este forward. El recalc anterior a audit26 no se admite como preimagen final.

Captura y compara OID, owner, ACL, SECURITY, search_path, retorno, argumentos/nombres/defaults, volatilidad, parallel, strict, leakproof, tipo/lenguaje y costo/filas estimadas. Un cambio inesperado revierte toda la transacción. CREATE OR REPLACE conserva permisos existentes, sin otorgar permisos nuevos ni certificar que los anteriores sean correctos. La entrada del auditor H6 admite únicamente nombre y SHA-256 exactos; bytes alterados vuelven a las reglas normales. Sigue prohibido GRANT TO PUBLIC.

El espejo individual existente de recalc se actualiza. El baseline completo se genera mediante `scripts/db/schema-snapshot.sh` tras el post-migrate oficial; no se editan a mano delimitadores ni blancos. El dump integrado generado por pg_dump17.11 sobre PostgreSQL17.9 coincide byte por byte con el artifact CI17.9 corregido de PR313 fuera de estas dos funciones. La referencia de ese artifact es SHA-256 `b6169a2fe0afa27aecd6e921841dafdfd07382ea141011ec0c74d149ee800ffa`. Las 45 entradas históricas del manifiesto permanecen intactas; se agrega exclusivamente este forward a la versión actual 13.824.81.

## Verificación ejecutada

- Replay integral del preparador CI sin modificar: bootstrap, squash y 333 migraciones; una migración de datos puntual omitida por el inventario existente. Post-migrate oficial, cobertura RLS e integridad de schema pasan.
- Snapshot completo del generador oficial igual al baseline integrado: diff vacío antes de fixtures; un segundo snapshot tras todos los guards/RLS sigue idéntico y el trigger NC queda habilitado (`O`). 223/223 guards del manifiesto y 58/58 suites RLS del repositorio pasan, incluida la regresión histórica NC corregida de PR313, consumida intacta con SHA-256 `ead0855eb6e9f9a77461a104f98ae0f65d9620bd398769983f493e65af3b7ccb`.
- El catálogo del replay conserva owner `postgres` y las ACL no triviales existentes de ambos RPC y de las tres funciones de PR313. Ningún guard se omite ni se relaja. Las comprobaciones opcionales adicionales de envelopes/clones del workflow remoto no se ejecutan en esta reproducción local.

- PostgreSQL 17 desechable con binarios ya presentes: 31 aserciones funcionales y una comprobación estructural, dos aplicaciones consecutivas del forward y seis escenarios concurrentes reales por ejecución.
- Ejecución tanto desde las definiciones históricas canónicas como desde una reconstrucción enfocada del estado efectivo de replay: TC del squash y recalc de audit26. Esto prueba admisión de esas funciones; no es un replay integral de Supabase.
- Fórmulas de recalc comprobadas con bases fraccionarias, IVA por línea, tasas de 16%/8%, override de tasa, retenciones, defaults nulos, conceptos borrados y ausencia de conceptos.
- TC comprueba padre activo/eliminado/ausente, cerrado/cancelado, organización ajena, roles admin/operador/contador/viewer/admin_org/super_admin, ausencia de identidad/organización, DOF ausente/inválido, EUR cero/nulo y respuesta exacta. Se usa el cuerpo real de `_assert_writer` y stubs explícitos de identidad/rol/organización/DOF.
- Dos workers PostgreSQL y una conexión observadora: eliminación antes de recalc, eliminación/cancelación/cierre antes de TC, y eliminación/cancelación mientras TC está dentro de la consulta DOF. Se observa `wait_event_type = Lock` para verificar el bloqueo, no solo el valor final.
- Control anterior con el cuerpo y trigger reales `tg_bloquear_embarque_cerrado_self`/`trg_bloquear_embarque_self`, extraídos del baseline: cinco intercalados sintéticos reproducen escrituras tardías, pero Cerrado ya rechaza la escritura del RPC anterior y conserva TC18. Para Cerrado, el nuevo bloqueo es defensa en profundidad; no se demuestra una vulnerabilidad real de cierre. Cancelado y borrado sí reproducen escritura tardía incluso con ese trigger. Controles negativos separados: restaurar recalc o TC original hace fallar su regresión de padre eliminado. Un cuerpo no revisado hace fallar la admisión.
- 60 pruebas Vitest: ambos forwards ACL, perfiles exactos de replay y cobertura LC. Se añadieron mensajes amigables para los dos códigos nuevos del forward sin ignorar casos en el guard de cobertura. ESLint enfocado, auditor de migraciones, integridad de funciones espejo, replay/mirror y manifiesto pasan. Replay/mirror conserva las dos divergencias preexistentes con huella exacta; no se alteró su baseline de deuda.
- Comparación estática confirma que, al retirar exclusivamente el nuevo bloqueo/salida temprana y predicados activos, los dos cuerpos restantes son idénticos byte a byte a sus fuentes. No se alteraron fórmulas, helper de permisos ni respuesta.

## Reproducción

Se requieren Python, PostgreSQL 17 y psql ya instalados:

```sh
POSTGRES_BIN=/ruta/postgres/bin PSQL_BIN=/ruta/psql \
  bash scripts/ci/remaining-parent/run-local.sh
```

El runner enfocado crea un cluster UTF8 nuevo, usa solo loopback y un directorio temporal propio, ignora variables libpq/URLs heredadas y detiene el servidor al terminar. No instala herramientas ni crea roles/grants. El replay completo, realizado separadamente, utiliza el bootstrap CI existente con sus roles y ACL únicamente dentro de otro cluster vacío y desechable; no cambia accesos en sistemas externos. `TEST_PG_PORT` permite cambiar el puerto de prueba.

- `BASELINE_SOURCE=replay`: variante efectiva enfocada del squash + audit26.
- `NEGATIVE_CONTROL=1`: ejecuta seis intercalados con las funciones anteriores y el trigger real de cierre; afirma cinco escrituras tardías sintéticas y el rechazo existente de Cerrado. Debe terminar correctamente al observar ambas clases de resultado.
- `NEGATIVE_SCOPE=recalc_factura_totales` o `NEGATIVE_SCOPE=actualizar_tc_embarque_dof`: restituye solo esa función anterior; debe fallar una aserción.
- `ADMISSION_NEGATIVE=body`: introduce deriva de cuerpo local; debe fallar el forward antes de reemplazar funciones.

## Límites

La batería enfocada usa tablas sintéticas reducidas y el dueño de un cluster nuevo; su ACL inicial NULL se conserva. El replay completo y las suites RLS se ejecutan separadamente sobre el schema reconstruido y sus ACL no triviales; no validan PostgREST, usuarios reales ni una base hospedada. Ninguna prueba local certifica permisos de producción. El modo INVOKER permanece y no se añaden privilegios para obtener el row lock. Las pruebas de rol TC verifican la lógica exacta de `_assert_writer` con helpers simulados, no autenticación real.

Los intercalados se ejecutan en READ COMMITTED. No se reclama cierre global de todas las carreras del ERP, ni serialización de toda modificación directa de conceptos ni prueba de cualquier aislamiento. El trigger real de cierre ya impide modificar un embarque Cerrado: se incluye explícitamente en el fixture. Cancelado no activa ese mismo candado. Otros triggers de producción podrían impedir introducir ciertos estados; estas pruebas no afirman explotación desde la UI ni reproducen todos los flujos del ERP. La conexión observadora solo consulta actividad local.

No se ejecutó suite frontend completa/build ni CI remoto de este overlay. El repositorio se materializó por blobs verificados para las fuentes/checks disponibles; no es un checkout completo de todos los archivos.

## Integración con PR313

Los cuatro archivos compartidos se unieron mediante cambios acotados sobre la cabeza de PR313: registro ACL, baseline generado, manifiesto de migraciones y manifiesto de guards. Se conservan el forward NC/REP/sustitución completo, su hash corregido, sus tres funciones y todas sus entradas; el catálogo de mensajes también conserva los tres códigos de PR313. Los checks del forward de hijos se ejecutan junto a los de esta segunda corrección.

El overlay no cambia el forward `20261013141500_factura_eliminada_guard_hijos.sql`. El forward propio conserva su SHA-256 revisado `c8c35b161ecc4ff96172675442117ae348dba368a54ba9c8e3f02b16e40a5576` y no relaja ninguna precondición.

Si el catálogo remoto no satisface las precondiciones, detenerse y revisar la diferencia. Este paquete no autoriza migraciones remotas ni amplía la aceptación para ocultar drift.
