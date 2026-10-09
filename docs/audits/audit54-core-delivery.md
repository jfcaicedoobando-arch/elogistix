# AUD54 núcleo: entrega segregada sobre main38

Base remota: `731f7903e82782a81391489c19cf178ee6051b81` (main38). Base local byte-equivalente: `94e5c70fae78688c8a43abf56c70cc0fb32d3197`; el árbol remoto completo fue confirmado como954a14114438be56a707c85e5ccc6ce12e08f06d, igual al local. El traslado aplica por hunks el núcleo revisado sobre esa base. Fuente revisada: `3734da46ddfba45fcb36dd2245acd0ee7e8d2cbd`, trasladada sin cambio funcional a `2db2161bf6e41ffd64412c685dfb5eb13f4dc4c9`.

## Alcance

Esta partición conserva los 62 paths funcionales propuestos para el núcleo54: canon monetario, PUE de una exhibición, deuda documentada con pago activo, cartera/cobranza/estado de cuenta, controles de lote y ocho funciones SQL. El baseline se compone sólo con esas ocho definiciones; los guards añaden sólo sus dos suites. No incluye cambios de anticipos135/131, FX134, cierre139, Dirección ni contadores141.

La migración `20261007235500_audit54_saldo_monetario_real.sql` conserva exactamente los bytes revisados. Su ID sigue siendo provisional; no reserva una versión ni modifica manifests publicados33–38, Drizzle o datos históricos. No ejecuta SQL remoto ni despliega.

## Dependencias y revisión

PR168 se actualizará sobre esta rama con el propósito141 exclusivamente: dos contadores complementarios de México y su invalidación. Dirección Decimal y el cierre CxC se conservan en el candidato combinado revisado y requieren una entrega posterior, cuyo cierre conserve la cadena135→131→134→139. Ningún archivo exclusivo de esa cadena se incluye aquí.

Los drafts permiten revisar por separado, pero AUD54 sigue abierto hasta componer todos los consumidores, elegir el release final, verificar backend y frontend integrados y realizar la comprobación GUI. No se permite fusionar parcialmente si el canal publica automáticamente. Los RPC141 deben existir antes de publicar el frontend141.

## Validación

Los 60 archivos no compartidos se copiaron exactamente del snapshot revisado. Baseline y lista de guards se segregaron por función/entrada. Las ejecuciones históricas del candidato completo no se presentan como CI de esta partición. La comprobación de esta nueva composición y su CI se anotarán en los PRs. `audit:manifest` queda pendiente/no pasado hasta que la entrega futura asigne release a los SQL nuevos; no se modifica ni debilita el guard.

Ver [contrato y evidencia histórica del núcleo](audit54-real-cent-residual.md). La suite financiera genérica conserva su fallo previo de preparación de auth.users; no se cuenta como aprobada.

Integración38: conserva SQL135, su función y su guard; éste se une con las dos suites54 sin borrar entradas. El refinamiento de CI modifica únicamente fixtures, comprobaciones de arquitectura y presentación accesible. Las reglas monetarias y SQL2355 permanecen iguales.
