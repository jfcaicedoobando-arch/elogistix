# Consistencia del indicador de proformas

## Contrato

`embarques.tiene_proforma` representa la existencia de una proforma operativa del embarque:

- Excluye las proformas en papelera, canceladas y rechazadas por el cliente.
- Excluye los originales consolidados, identificados por `estado_revision = 'consolidada'` o por `consolidada_en` no nulo. Cancelar la resultante no reactiva los originales.
- Un borrador requiere al menos un concepto de venta vinculado y no eliminado.
- Una proforma facturada sigue contando aunque no conserve conceptos de venta vivos. Los filtros de cancelación, papelera, rechazo y consolidación siguen aplicándose.
- Una proforma aprobada operativa conserva la semántica previa aunque no tenga conceptos. Este indicador no sustituye las validaciones para facturar o cerrar.
- `embarque_id` es el vínculo operativo singular. No se interpreta el campo histórico `embarques_ids` como una nueva funcionalidad multiembarque.

Sólo `recompute_embarque_tiene_proforma(uuid)` escribe este agregado. `liberar_conceptos_de_proforma` delega en él y mantiene sin cambios los conceptos históricos eliminados. El helper no modifica `updated_at` ni dispara auditoría del embarque cuando el indicador no cambia.

## Concurrencia

Los dos triggers serializan las proformas afectadas mediante bloqueos advisory transaccionales. El orden de adquisición es el de las claves bigint efectivas, no el del hash de una colección completa. Esto también protege el vínculo cuando una proforma aún no tiene embarque.

Luego bloquean ambos embarques afectados en orden UUID con `FOR NO KEY UPDATE`. El helper toma su bloqueo y realiza el cálculo en una sentencia posterior: con el aislamiento habitual `READ COMMITTED`, una transacción que esperó ve el resultado confirmado del escritor anterior. `NO KEY UPDATE` es compatible con los bloqueos `KEY SHARE` de las claves foráneas.

Las actualizaciones de metadatos que no afectan el contrato no toman estos bloqueos. Un cambio de pertenencia observado durante la espera se rechaza con `40001`; no se guarda un agregado con un vínculo obsoleto.

Esto no promete ausencia universal de deadlocks. DML arbitrario multisentencia, cambios masivos con órdenes distintos y flujos existentes que primero bloquean embarques y después hijos pueden requerir reintentar la transacción completa por `40P01` o `40001`. No se reintenta sólo una sentencia ya fallida ni se repite una comunicación externa. La integración debe preservar las claves de idempotencia de las operaciones que las admiten.

## Cierre, permisos y excepciones técnicas

El helper y la propagación de `estado_facturacion` usan un `SET app.bypass_cierre` acotado a la función. PostgreSQL restaura el valor previo tanto al salir como al abortar. Generar una proforma en un embarque cerrado se rechaza antes de insertar el encabezado, conforme al contrato vigente de reapertura.

Las respuestas manuales y por token mantienen sus comprobaciones actuales de permisos, token y estado. Sólo la liberación técnica posterior a un rechazo validado obtiene una excepción acotada; no se habilita edición posterior del embarque. Consolidar conserva su excepción explícita para repuntar conceptos, ahora restaurando el valor anterior. Las propagaciones fiscales de estado mantienen su comportamiento; el cambio no habilita nuevos INSERT financieros en embarques cerrados.

Restaurar un concepto previamente eliminado conserva su vínculo histórico con la proforma. Si ésta ya fue rechazada o cancelada, el indicador no vuelve a activarse; reutilizar ese concepto requiere una decisión explícita de reasignación/liberación. Este arreglo no incorpora una desvinculación automática al restaurar ni cambia la función genérica de restauración.

Esta corrección funcional reexpresa las ACL existentes sin ampliarlas ni retirarlas. El endurecimiento de `EXECUTE` del helper es una propuesta independiente y requiere la confirmación de seguridad correspondiente antes de aplicarse. Tampoco se cambian las ACL de los triggers ni de `liberar_conceptos_de_proforma` en este trabajo funcional.

## Aplicación y datos existentes

1. Conservar intactos Drizzle `0008` y `0009` y su replay histórico.
2. Aplicar primero la reemisión idéntica de compatibilidad `20261006223000_proforma_helper_acl_restatement.sql` del trabajo de infraestructura.
3. Aplicar después `20261006230000_proforma_operativa_consistencia.sql` mediante el proceso de revisión y despliegue autorizado.

El forward contiene DDL de funciones/triggers y reexpresión de permisos. No recalcula filas existentes, no cambia estados históricos y no ejecuta un backfill. La consulta `scripts/db/report-proforma-operativa-drift.sql` permite revisar diferencias antes de decidir una reparación separada de datos.

## Verificación

- `supabase/tests/proforma_operativa_consistencia.sql`: fixtures de dominio completos y reversibles, estados, papelera, borradores, consolidadas, rechazo, facturada, snapshots, timestamps, rollback y ámbito del bypass.
- `scripts/db/test-proforma-consistency-concurrency.mjs`: Postgres local aislado ya preparado; compara resultados de transacciones reales y usa esperas de bloqueo verificadas.
- Regresiones SQL existentes: generación/IVA y requisito de aceptación del cliente.
- Guards de migración, espejo SQL e historial inmutable; pruebas frontend de proformas y eliminación.

Las pruebas son locales. No equivalen a haber migrado una base remota ni a haber desplegado el ERP. No incluyen pruebas ofensivas, exploración entre organizaciones ni cambios de ACL en producción.

### Resultado local (2026-10-06)

PostgreSQL 17.9: suite completa de dominio verde, incluida la RPC real de consolidación sobre embarques cerrados con bypass previo `off` y `on`, fallos forzados reversibles y restauración de conceptos históricos. Los 10 escenarios concurrentes pasaron cinco repeticiones consecutivas. Las tres regresiones SQL existentes pasaron. El reporte de diferencias se ejecutó sin escribir; detectó únicamente un fixture obsoleto creado deliberadamente para reproducir la carrera antes de corregirla.

Frontend: 350 pruebas relacionadas en 62 archivos, TypeScript y build local correctos. El snapshot normalizado de PostgreSQL 17.9 coincide exactamente con el baseline actualizado. Auditoría de espejos y funciones correcta. La composición del guard de migraciones depende de la entrega de infraestructura previa; la versión y el manifiesto de release se asignan durante la integración, no en esta corrección aislada.

Hallazgo preexistente fuera de alcance: la consolidación de `no_objeto` intenta persistir una tasa NULL en `proforma_conceptos_consolidados.tasa_iva_aplicada`, columna actualmente NOT NULL. No se alteró ese tratamiento fiscal en esta corrección; las pruebas de mecánica de consolidación utilizan `tasa_0` válida.
