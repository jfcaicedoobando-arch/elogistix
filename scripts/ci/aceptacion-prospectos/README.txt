CANDIDATO PARA CI AISLADO — SQL NO EJECUTADO EN ESTA TAREA

Base de integración: b355e978bd2fa8adda3195218d32cc61bfbfcc98
Migración propia: supabase/migrations/20261012160000_aceptacion_prospectos_crm.sql
Espejo: supabase/schema/cotizaciones/aceptar_cotizacion_version.sql
Ambos contienen los mismos bytes. No se cambia conversión ni visibilidad.

assertions.sql usa fixtures propios, sesión/roles de prueba y rollback, con los
triggers del esquema completo activos. Cubre cliente de casa sin oportunidad,
prospecto enviado con/sin vínculos empresariales, Aceptar → Convertir original,
retry antes/después, fiscal incompleto sin parcial, SoD/tenant, moneda alterada
DESPUÉS del INSERT, sello, monto, lead/empresa no convertidos al aceptar y
auditoría/notificación únicas. Es candidato ejecutable, no evidencia de aprobación.
Usa gerente_operaciones, seeds auth estrictos skip_auto_org y el espejo real de
membership para user_roles (sin doble INSERT), siguiendo neutral-cases.sql del
commit 2baa3ec3b05f98f1091737ada8b27de1f4e4e27c. No desactiva FK/ACL/triggers.
El guard existente cotizacion_aceptar_cliente_candado conserva el candado general
y agrega comprobaciones estáticas de la excepción; tampoco sustituye RLS/CI real.

Root/agente CI completarán la suite real y su evidencia, incluyendo:
- rol rechazado/sin sesión, vigencia expirada y monto cero;
- oportunidad perdida o con ganadora ajena;
- oportunidad/etapa/lead/empresa eliminados o de otra organización;
- ambos linajes empresa: crm_oportunidad_empresa y crm_empresas.lead_origen_id;
- no exigir nuevos vínculos empresa en datos históricos sin esos vínculos;
- retry Aceptada sin cliente con sello ausente/incompleto: falla sin reparar;
- dos aceptaciones competidoras, misma cotización y distintas hermanas;
- aceptación competidora mientras conversión original revincula hermanas;
- conversión concurrente con retry de la misma cotización.

Concurrencia nueva: el prospecto toma cotización y CRM con FOR UPDATE NOWAIT en
CRM; si está ocupado devuelve LC_COTIZACION_EN_PROCESO / SQLSTATE 55P03 antes de
escribir. Esto evita esperar CRM reteniendo una hermana que la conversión intenta
revincular. Después se reintenta la misma autoridad canónica: éxito idempotente
si ya aceptó, o conflicto de ganadora si ganó otra. No convertir ese rechazo en
éxito, no hacer fallback UPDATE y no fabricar sellos para probarlo.

La baseline debe REGENERARSE con PostgreSQL 17.9 del repo después de replay +
migración nueva y ANTES de fixtures. No fue editada a mano en esta tarea ni se
afirma que el dump actual coincida con el backend candidato. PostgreSQL 17.6
puede aportar diagnóstico, pero no confirma la baseline requerida en 17.9.
Root coordina esa ejecución, integración del dump, registro y resultados CI.
El manifest sólo añade la migración a 13.824.71, conservando las 36 entradas
históricas; el actualizador genérico que poda historia no se conserva en el diff.

No se toca NC/PR258, types.ts, la base remota, Q06 ni turnos externos de Lovable.
Los blobs base revisados en v2 coinciden con b355; verificar main antes de integrar.

Revisión v3 cloud: el único cambio productivo respecto a v2 elimina el veto
cliente_id de empresa accesoria M:N. Permanecen validaciones de tenant, ID y
borrado; el linaje principal lead_origen_id sigue rechazando empresa convertida.
El retry posterior a conversión recalcula origen_aceptacion según el cliente,
igual que la rama original; no exige conservar el origen previo del prospecto.
Sello y auditoría no se reescriben. Las nuevas comprobaciones estáticas no
sustituyen ejecución SQL real ni concurrencia del workflow aislado.
