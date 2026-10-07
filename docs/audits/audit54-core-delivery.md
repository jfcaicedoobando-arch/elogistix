# AUD54 núcleo: entrega segregada sobre main37

Base remota: `57969acc4f89f7408fa6dc38bd769931f00cfe2d` (main37). Base local byte-equivalente: `87d3f418860ba201d921b9d65b9947e1ce884978`; se verificaron los hashes de las15rutas del delta remoto y el árbol completo. El traslado aplica por hunks el núcleo revisado sobre esa base. Fuente revisada: `3734da46ddfba45fcb36dd2245acd0ee7e8d2cbd`, trasladada sin cambio funcional a `2db2161bf6e41ffd64412c685dfb5eb13f4dc4c9`.

## Alcance

Esta partición conserva los 62 paths funcionales propuestos para el núcleo54: canon monetario, PUE de una exhibición, deuda documentada con pago activo, cartera/cobranza/estado de cuenta, controles de lote y ocho funciones SQL. El baseline se compone sólo con esas ocho definiciones; los guards añaden sólo sus dos suites. No incluye cambios de anticipos135/131, FX134, cierre139, Dirección ni contadores141.

La migración `20261007235500_audit54_saldo_monetario_real.sql` conserva exactamente los bytes revisados. Su ID sigue siendo provisional; no reserva una versión ni modifica manifests publicados33–37, Drizzle o datos históricos. No ejecuta SQL remoto ni despliega.

## Dependencias y revisión

PR168 se actualizará sobre esta rama con el propósito141 exclusivamente: dos contadores complementarios de México y su invalidación. Dirección Decimal y el cierre CxC se conservan en el candidato combinado revisado y requieren una entrega posterior, cuyo cierre conserve la cadena135→131→134→139. Ningún archivo exclusivo de esa cadena se incluye aquí.

Los drafts permiten revisar por separado, pero AUD54 sigue abierto hasta componer todos los consumidores, elegir el release final, verificar backend y frontend integrados y realizar la comprobación GUI. No se permite fusionar parcialmente si el canal publica automáticamente. Los RPC141 deben existir antes de publicar el frontend141.

## Validación

Los 60 archivos no compartidos se copiaron exactamente del snapshot revisado. Baseline y lista de guards se segregaron por función/entrada. Las ejecuciones históricas del candidato completo no se presentan como CI de esta partición. La comprobación de esta nueva composición y su CI se anotarán en los PRs. `audit:manifest` queda pendiente/no pasado hasta que la entrega futura asigne release a los SQL nuevos; no se modifica ni debilita el guard.

Ver [contrato y evidencia histórica del núcleo](audit54-real-cent-residual.md). La suite financiera genérica conserva su fallo previo de preparación de auth.users; no se cuenta como aprobada.
