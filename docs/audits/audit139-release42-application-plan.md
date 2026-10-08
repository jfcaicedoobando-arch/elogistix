# Release 13.824.42: deuda CxP por asignaciones efectivas

Estado: paquete local pendiente de validación propia y revisión independiente. No publicado, sin SQL remoto, PAC, hosting ni certificación GUI. Este documento no es un envelope ejecutable.

## Fuente, orden y preservación

- Padre41 exacto: `7ecd03bff6208c1e78f039effe3ad36c6ec5611c`, árbol `e630e395b12b197788347e56250271a4bf5da997`.
- Dependencias corregidas:39 `3951f5c5693344ec6895ad599ba409c1abd9ec38` →40 `c87a4229af9a5c269a048374d9c5cf3f17ec3821` →41. Se conservan la referencia NULL de devolución nueva, el selector congelado134 y la captura62/130.
- Fuente139: `6ff54a0f75a6347488b5665a15243d3ad3fe7f50`, delta contra `d95b8e7a6fd86cdbfa298f6743ae9daffe6db12f`. La función y formatter de ese padre son idénticos a41 antes del portado; se integra sólo ese delta, sin restaurar baseline antiguo.
- Migración reservada única: `20261007001300_audit139_cierre_saldo_atribuido.sql`; SHA-256 `7f40c34ea4441ab144602f1f2c5d268543cad1f881de312a91ed66ef4cc0b0e3`. SQL, espejo, formatter y tres suites139 se conservan exactamente de la fuente.
- Orden:35 →36 →37 CAS →38 cronología →39 devolución →40 congelado →41 captura →42 cierre atribuido. No se editan migraciones35–41, entradas históricas del manifest ni changelog previo. El manifest añade sólo42, con un archivo nuevo respecto a41; no se usa el actualizador que poda historial.
- SQL41 conserva SHA-256 `cc326f4f4766d3747e477fd37bfb1642b4268c44bc9ecc0f78443bb65a58e818`. Ningún otro split139/70/P&L/148 se incorpora.

## Contrato y alcance

Sólo se redefine `public.validar_cierre_embarque(uuid)`. Asignaciones con importe y cantidad efectiva positivos determinan pertenencia; cantidad NULL/cero mantiene la convención uno. Costes borrados y ajustes presupuestarios se excluyen. La cabecera participa sólo si no queda ninguna asignación efectiva. Cantidad se aplica una sola vez.

Subtotal y asignación total fijan el denominador mayor: un reparto parcial conserva el residuo sin asignar y un exceso se limita proporcionalmente. Total bruto, pagos reales, NC de proveedor Aplicadas y saldo no negativo de cada factura usan el mismo factor. Son importes calculados: no hay backfill ni nuevo linaje pago-embarque. CxC sigue admitiendo Timbrada/Aplicada; pagos134 usan el importe congelado incluso cero y no convierten NULL en conocido. La falta de tipo de cambio bloquea el cierre, con tolerancia0.01 por moneda. No se toca el resto de reglas de cierre.

El único cambio de UI de negocio es el formatter/desglose del cierre para explicar reparto proporcional y conversión pendiente. No altera captura, pagos, documentos fiscales, PDF ni consultas P&L. No cambia tablas, columnas, triggers, policies, datos, firma ni contrato de retorno.

## Compatibilidad futura con main

Main observado `0558ee70f5251abea985f959c540807d94c076d3` contiene143/PDF frontend posterior al ancestro compartido `003c8a7f4306e1f3ea0d7633985c496690b9e4b4`. Se conserva como rama independiente y no se mezcla al stack a ciegas. Su delta no toca la migración, espejo ni formatter139. Esto no certifica automáticamente compatibilidad de toda la composición39–42: hay consumidores de proveedor/tesorería/PDF que deben conservarse al reconciliar upstream. Un preview textual sin conflictos tampoco sustituye tipos, pruebas, build y replay sobre el SHA final.

Después de revisión independiente, la publicación propuesta apila42 contra41 corregido. Si main avanza o integra39–41, reconciliar el delta42 contra ese main y revisar cada conflicto preservando ambas mejoras. Repetir controles sobre el commit exacto antes de CI/merge. Un merge de código no aplica SQL ni publica hosting.

## Preflight futuro de aplicación

Identificar backend/proyecto y mecanismo autorizado; leer historiales Supabase/Drizzle, duplicados, high-water marks y hashes. Exigir prerequisitos efectivos y ausencia de01300 o cuerpo equivalente bajo otra migración. No usar reset/repair/include-all. Capturar catálogo completo antes de cualquier GRANT de CI: cuerpo, firma, retorno/defaults, owner, ACL canónica completa, privilegios efectivos, security definer, volatilidad, search_path y atributos de todas las funciones.

Comparar el cuerpo previo de cierre con41 revisado y verificar que no hay nueva lógica ajena que se perdería. Si hay drift, detener y reconciliar. Los REVOKE/GRANT del SQL fuente deben preservar el catálogo completo; no suponerlo por privilegios efectivos equivalentes. Validar en ensayo local antes de preparar envelope.

La futura operación requiere envelope revisado específico: una transacción con límites de lock/sentencia/inactividad, serialización de historiales y precondiciones repetidas; aplicar SQL exacto y registrar sólo01300. Verificar único cuerpo nuevo, demás objetos/ACL/historias y datos sin cambio antes de COMMIT. Drift, timeout o inconsistencias implican ROLLBACK. Transporte incierto exige releer catálogo/historial, nunca repetir a ciegas. Después del commit verificar desde otra transacción. No ejecutar fixtures en backend real.

## Validación exigida

Replay limpio del stack42, snapshot completo igual a baseline, todas las guardas oficiales/RLS y preservación CAS37. Forward41→42 ejecutado dos veces con fixture histórico sintético, igualdad de filas de todas las tablas públicas tras cada aplicación, catálogo idéntico al replay y sólo cuerpo de cierre cambiado. Controles rojos139 sobre41 deben fallar por atribución y volverse verdes con42. Probar131/134, NC clientes,62/130 en UTC/CDMX, formatter y regresiones de captura. Tipos app/node, build minificado serial, bundle, sourcemaps, licencia PDF y auditores. Mantener visible cualquier fallo heredado, sin editar allow-lists para ocultarlo.

Hasta registrar resultados de este paquete exacto y revisión independiente, la evidencia de fuentes es sólo antecedente. Sin pruebas GUI de la empresa de prueba autorizada no se declara cerrado139 ni el conjunto de auditorías.

## Recomposición local sobre main2538 y replay0010

Este candidato recompone el delta revisado `f625928628fb36de36a69266ec7b5e1e8155c343` sobre el padre `b5263ee3d70b1db73a4ac621eda0b736dac1f370`. Conserva el release39 revisado `32912a4fb8f3cd99af5c20644ee80b0b1b9986fa`, el replay Drizzle0010, su forward restrictivo234100 y los cambios CRM/Costeo heredados. Los manifiestos históricos35–39 permanecen iguales al nuevo39; sólo se actualiza la entrada inédita42 para incluir el inventario real. El SQL propio del paquete conserva sus bytes y SHA-256 de la fuente. Las validaciones descritas arriba pertenecen a la fuente histórica y no certifican esta nueva composición; la validación conjunta de la cadena se registra por separado. No se aplicó SQL remoto, no se publicó frontend y no se actualizó ningún PR.
