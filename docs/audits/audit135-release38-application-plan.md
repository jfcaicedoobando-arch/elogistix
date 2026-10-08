# Release 13.824.38: aplicación acotada de la cronología de anticipos

Estado: paquete de código y plan de aplicación. No ejecutado en un backend remoto. Este documento no es un script listo para ejecutar ni reemplaza la revisión de un envelope con preflight fresco.

## Fuente y límites

- Base remota: main `57969acc4f89f7408fa6dc38bd769931f00cfe2d`, release 37 / PR 180. Su árbol `ddd5614470d823f7688f8420daad11ae97fa7e8f` coincide exactamente con el commit local `87d3f418860ba201d921b9d65b9947e1ce884978`.
- Delta funcional: PR 178, HEAD revisado `048f1d9785a1ac3ebeb3671742f12b68f194d586`, árbol `52fb6fb836b423f35cbecedf448cd98e781aba0c` (local `d2336b0`). Incluye las correcciones de fixture UTC/MX, catálogo y límite de líneas ya verificadas.
- Única fuente SQL nueva: `supabase/migrations/20261006233700_audit135_anticipo_cronologia.sql`.
- SHA-256: `8703fd2ddb3764bd5dec415ada4be55cae32fcf0568068ac21846f809ae8916f`. El espejo canónico conserva los mismos bytes.
- Único cuerpo sustituido: `public.aplicar_anticipo_a_factura(uuid,uuid,numeric,date,uuid)`. El baseline incorpora sólo ocho líneas de cronología sobre main 37; las dos guardas CAS con PT409 permanecen intactas.
- No se incluyen otras migraciones contables, PR 179, las particiones 54/141 ni una repetición de 140. No hay backfill, cambios de hechos financieros ni cambio de permisos efectivos.

## Manifiesto e historia

38 contiene 1.482 nombres de migración: exactamente el inventario de 37 más `20261006233700_audit135_anticipo_cronologia.sql`. Las entradas activas 35, 36 y 37 se conservan íntegras, sin poda. Se mantiene también el archivo histórico 35 y todo el registro/archivo de retiro de 2300. La historia de 33/34 no se restaura ni reescribe.

La conservación de cuatro entradas activas es deliberada para esta entrega: no se usa `--update`, que poda a tres. El guard existente sigue comparando sólo APP_VERSION con el disco; no se modifica ni debilita. El changelog anterior permanece byte a byte detrás de la nueva entrada 38.

## Orden y precondiciones antes de cualquier aplicación

1. Identificar y volver a verificar el proyecto/backend exacto autorizado y el mecanismo que registra migraciones. No deducir estado de la base a partir de un merge GitHub o de la versión visible del frontend.
2. Completar y verificar primero CAS 37: `20261006233500_cxp_cas_conflicts_non_retryable.sql`, SHA-256 `2c67b2aa897a26816dc2fca9cc8c93118b5012ddd274eac8b12f590d0afc415b`. Estar fusionada no acredita aplicación. Deben existir sus dos definiciones finales PT409 y su registro exacto; de lo contrario, detener 38 y aplicar el plan 37 por separado.
3. Confirmar los prerrequisitos de proformas `20261006225000` y `20261006233000`, conservando el retiro de `20261006230000`. Un target con 2300 registrada exige reconciliación propia, nunca un skip genérico o reparación del ledger.
4. Leer ambos historiales, Supabase y Drizzle, sus hashes/fuentes exactas y el high-water mark. Exigir ausencia de 233700, de cualquier registro equivalente de la antigua propuesta 135 y del mismo hash en el otro mecanismo. Detenerse ante ejecución previa, ambigüedad, drift o una migración posterior que haga retroceder el orden de aplicación. No usar `--include-all` ni `migration repair`.
5. Capturar definición efectiva de la RPC, firma/retorno/defaults, sobrecargas, propietario, ACL canónicas, privilegios efectivos de PUBLIC/anon/authenticated/service_role, SECURITY DEFINER, volatilidad y search_path. Comparar con la función pre-135 efectiva de main 37; las funciones CAS deben permanecer en su estado final 37.
6. Capturar el rol de sesión/current_user y capacidades necesarias. No elevar el rol ni conceder permisos nuevos para conseguir que pase la instalación. Verificar nuevamente los hashes de fuente/mirror, el manifiesto 38 y el estado del PR exacto revisado.

Falta la captura remota fresca específica de 135. Por ello este paquete no fija hashes ficticios de un target, no autoriza ejecución y no contiene un envelope remoto listo para lanzar. El envelope ejecutable debe generarse y revisarse después de ese preflight; 38 no puede saltarse el CAS pendiente.

## Plan de transacción única

Con autorización de ejecución independiente y un envelope ligado al preflight:

1. Iniciar una sola transacción con límites acotados (`lock_timeout` 5 s, `statement_timeout` 60 s e `idle_in_transaction_session_timeout` 90 s, salvo ajuste revisado por el responsable).
2. Serializar contra ambos ledgers por el mecanismo aprobado. Repetir dentro de esa misma transacción todas las precondiciones de rol, función, permisos, prerrequisitos, ausencia e historia; guardar hashes/digests del estado anterior.
3. Ejecutar el archivo 233700 completo y exacto, sin extraer fragmentos, sin cambiar su timestamp y sin mezclar otras migraciones. No invocar funciones de negocio ni crear datos de prueba en el backend real.
4. Registrar únicamente 233700 como parte de la misma operación atómica del mecanismo aprobado, guardando su fuente exacta/hash. No registrar archivos retirados o propuestas anteriores como si se hubieran aplicado; no duplicar la inscripción en Drizzle.
5. Validar antes de COMMIT la definición final esperada, exactamente las ocho líneas nuevas y todos los atributos/privilegios sin cambios. Revalidar las funciones CAS 37 y el digest de todas las filas históricas de ambos ledgers; sólo se permite la fila nueva de 233700 en el ledger autorizado.
6. Confirmar sólo si todas las postcondiciones pasan. Después, realizar lectura nueva del registro/hash y del catálogo desde otra transacción. La publicación del frontend 38 y una prueba funcional no productiva son acciones posteriores separadas.

Cualquier drift, lock timeout, fallo DDL, fallo del registro o postcondición provoca ROLLBACK de toda la transacción. Un resultado de transporte incierto exige inspeccionar catálogo e historial antes de reintentar; nunca asumir que no se aplicó.

## Reversión y recuperación

- Antes de COMMIT: abortar la transacción; deben permanecer iguales definición, owner, ACL y ambos ledgers. No continuar desde un fragmento que quedó a mitad del proceso.
- Después de COMMIT: no borrar ni editar 233700, no quitar su fila de historial, no cambiar una migración aplicada y no ejecutar automáticamente el snapshot antiguo. El responsable debe revisar el estado real y cualquier actividad posterior. Si decide revertir, preparar una nueva migración forward con timestamp posterior, fuente revisada, precondiciones y nuevo registro; coordinar también la compatibilidad del frontend. No inventar una reversión de pagos o de datos históricos: 38 no los reescribe.
- Conservar el snapshot previo y evidencia de error para diseñar ese forward. El plan nunca autoriza reset, repair, bypass de guardas o cambios de permisos.

## Secuencia parcial del backlog, fuera de este paquete

Las fechas completas propuestas son: 135 `20261006233700`, 131 `20261006234200`, 134 `20261006235700`, captura 62/130 `20261007001000`, 139 `20261007001300`, Aging 70 `20261007001600`, Por Pagar 70 `20261007001700`, prerrequisitos 148 `20261007001800`, P&L `20261007003200`, PR 179 `20261007023000`, canceladas `20261007025000`, particiones 54/141 `20261007235500`/`20261007235600`, y residual 54 `20261007235800` (depende de 139 y 54/141).

Las propuestas 145 (`20261006164000`, archivo todavía sin commit en su checkout reconstruido) y 147 (`20261006200500`) son anteriores a migraciones ya entregadas: necesitan nombre forward nuevo y replay antes de integrarse, nunca aplicación con esos nombres antiguos. Esta lista sirve para coordinar los candidatos identificados; no certifica un inventario global exhaustivo ni su revisión vigente.

135 es una entrega independiente y mínima. Los otros candidatos necesitan revisión y coordinación propias; el índice histórico de splits no certifica su estado actual. Antes de entregar un timestamp posterior hay que resolver los anteriores pendientes o re-fechar únicamente archivos todavía inéditos con revisión y replay. Nunca renombrar una migración ya publicada/aplicada para ocultar drift. 70 sigue siendo independiente de 139/P&L, con dependencia semántica de 134; el orden real debe respetar esos timestamps o corregir sólo propuestas aún inéditas.
