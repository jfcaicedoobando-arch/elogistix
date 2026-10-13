# Rentabilidad: autorización por rol y empresa

`profit_por_cliente(date,date,text,uuid)` autoriza antes de consultar finanzas. La
firma, SECURITY DEFINER, STABLE, search_path, propietario postgres y ACL se
conservan. Su cuerpo cambia de SQL a PL/pgSQL para garantizar un rechazo temprano
con SQLSTATE 42501, incluso cuando los filtros producirían cero filas. El wrapper
SECURITY INVOKER `reportes_resumen` queda protegido por la misma entrada; no se
modifican sus permisos ni `get_user_context`.

## Contrato

- Lista exacta: admin, admin_org, super_admin, ejecutivo_pricing, contador,
  tesorero, gerente_operaciones, gerente_comercial, gerente_visor,
  auxiliar_contable. No se usa la jerarquía de `has_role` para autorizar.
- Superadmin se acredita exclusivamente en `user_roles`; requiere empresa
  seleccionada activa para devolver datos. Sin selección devuelve cero filas.
- Otros usuarios requieren membresía del usuario en el `org_scope` resuelto y
  `organizations.activo IS TRUE`. Su rol de esa membresía prevalece sobre el
  global. No se obtiene `orgRole` de una consulta no acotada a la empresa.
- Sólo el valor legacy `super_admin` del rol de membresía permite fallback al rol
  global exacto; no confiere privilegios de plataforma. Se conserva la prioridad
  global de `get_user_context` con desempate por nombre para prioridades iguales.
- Se rechazan explícitamente usuarios legacy que sólo tengan rol global sin
  membresía y miembros de una empresa inactiva. Es un cierre de acceso deliberado.
- `service_role` sin UID y sin scope sigue devolviendo cero filas. Con UID pasa
  los mismos controles. Una claim de service_role no habilita este camino cuando
  el rol real de conexión es authenticated. Ninguna nueva ACL permite anon.
- Scope se evalúa una vez y se reutiliza en el filtro y el helper de ventas. Los
  cálculos, conversión monetaria, fechas, soft delete y estados no cambian.

## Limitaciones reales del esquema

`organization_members` no tiene estado activo ni deleted_at: membresía activa se
interpreta como fila presente y empresa activa. `role` es NOT NULL; NULL sólo se
maneja defensivamente y no se fabrica violando ese constraint. El índice único
`organization_members_user_id_unique` impide dos membresías simultáneas por
usuario. La prueba A→B mueve la membresía de forma secuencial, sin quitar el índice.
No se afirma que actualmente puedan existir usuarios multiempresa.

## Evidencia reproducible

`supabase/tests/profit_role_authorization.sql` se ejecuta como guard canónico
BEGIN/ROLLBACK, con datos sintéticos. Prueba los 18 roles reales (10 permitidos y
8 denegados), llamadas directa/filtrada/wrapper, igualdad financiera USD/MXN,
precedencia, fallback legacy, cambio de empresa, empresa inactiva, membresía/rol
faltantes, superadmin con A/B/sin selección/inactiva, service_role y anon.

Los cuatro triggers de admisión/sincronización indicados en el fixture se suspenden
sólo al sembrar estados históricos imposibles de crear hoy y se reactivan antes de
las llamadas. No se cambian constraints ni políticas y la transacción se revierte.
El negativo contra la función previa falla por una llamada financiera que se
permite indebidamente, no por error de fixture. El candidato pasa dos veces.

La migración exige catálogo y huella del cuerpo revisados antes de reemplazarlo,
reafirma sólo la ACL existente y verifica todos los atributos de pg_proc excepto
los dos cambios intencionales: prosrc y prolang. Acepta su propia huella para
reaplicación. Si hay drift, aborta; no normaliza silenciosamente permisos.

Validación local: PostgreSQL 17.9, snapshot normalizado con pg_dump 17.11 del mismo
major. Guards canónicos: 220/220; suites RLS: 57/57. Los auditores de migraciones,
manifest, replay-mirror, funciones y columnas pasan. La CI con cliente 17.9 fijado
sigue siendo la comprobación final de bytes y de la integración con main.

El script genérico local-verify ejecuta también `selector148_disabled_gate.sql`
fuera de su fase serial y produce un fallo ajeno a este cambio. El runner canónico
`run-guards.sh` sigue su manifest sin esa prueba serial y pasa íntegro; no se
modificó el auditor, el runner ni el test selector.

Rebase sobre PR277 (`6680ad94ccf58aa58f37ea01602503f3ec0904c6`): replay limpio
completo coincide byte por byte con el baseline reconciliado más este guard. Se
preservan los dashboards, su regresión FX y el historial completo del manifest.
La migración de autorización conserva exactamente el payload revisado.
