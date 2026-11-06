# Límite de permisos de coordinador (0040)

0038 añadió asignación fija y RPC de coordinación, pero el permiso UPDATE general de clientes permitía modificar directamente coordinador_logistico_id. La interfaz no basta como control de seguridad.

0040 agrega un trigger INVOKER antes de INSERT/UPDATE de clientes. Conserva cambios ordinarios y valores de coordinador sin cambios; exige permiso y coordinador válido si se modifica la asignación. Sólo confía en el propietario real de clientes para preservar el primer handover automático y los RPC validados. No utiliza GUC ni profundidad de trigger como autorización.

El helper y los dos RPC exigen usuario y organización activa coincidente, incluso para super_admin. Se bloquean objetivos de otra empresa antes de modificar datos; las filas pertinentes se bloquean en los RPC. No se añaden grants, membresías ni permisos de esquema. Los dos triggers privados tienen EXECUTE cerrado y contexto/paths explícitos; el harness de CI no puede reabrirlos.

No cambia roles aceptados por cada RPC, no sincroniza embarques existentes y no hace backfill. El selector y la visibilidad de membresías tienen observaciones funcionales separadas; esta migración no amplía RLS para resolverlas.

## Pruebas

- Fixture sintético: reproduce escritura directa previa y comprueba roles, NULL, tenant, super_admin, propietario, tablas temporales, trigger falsificado y ACL.
- Guard con esquema real: usa contador como actor no autorizado (operador es legacy y no admite nuevas membresías), conserva edición normal y valida RPC/admin y tenant. La asignación automática se cubre en el fixture sintético y en los guards de cotización de la suite completa.
- Replay local completo: 228 guards y 66 suites RLS. Snapshot sin cambios después de pruebas. El primer intento del guard detectó el rol legacy inválido del fixture; se corrigió sólo el actor de prueba, sin cambiar SQL.
- Cinco mutaciones negativas de ACL, owner, SECURITY DEFINER y search_path se rechazan con rollback; el snapshot posterior permanece idéntico.
- Soporte CI verifica propietario, membresías API, tipo y contexto de ambas funciones trigger, path y ACL exacta antes y después de los grants artificiales.

Aplicar requiere preflight independiente del estado real y autorización vigente. No se ejecutó 0040 en una base real ni se modificaron datos históricos.
