# Separar telemetría de plataforma (Super Admin) de las vistas operativas del tenant

## El problema (confirmado en la base de datos)

Las políticas de seguridad (RLS) de las tablas de negocio dicen hoy, en esencia:

> "puedes ver la fila si es de tu organización **o si eres super admin**"

Esa segunda parte no está limitada al tenant que el super admin eligió en el `OrgSwitcher`. Verificado con consulta a `pg_policies`: **174 políticas en 68 tablas** de negocio (`embarques`, `facturas`, `clientes`, `proveedores`, `pagos_factura`, `proveedor_facturas`, `bbva_movimientos`, `conceptos_costo`, CRM, presupuesto, refacturaciones, etc.) tienen ese "o eres super admin" sin acotar.

Consecuencia: cuando una consulta del front no lleva un `organization_id` explícito (un escaneo del código encontró más de 150 consultas de ese tipo, muchas legítimas porque confían en RLS), el super admin recibe filas de **todas** las organizaciones mezcladas con las del tenant seleccionado. Es exactamente el síntoma ya reportado antes ("elegí Chino Cochino y veo datos de otra org").

También verificado: ya existe la función `public.org_scope()`, que devuelve la organización correcta según el caso (el tenant activo de `super_admin_org_activa` para el super admin, la propia para un usuario normal), y ya la usan 20 RPCs de agregación (dashboards, cobranza, conciliación, búsqueda global). **Ninguna política RLS la usa todavía** (0 de 174). Ahí está la brecha.

## Qué se va a hacer

Dos planos separados y explícitos:

1. **Plano tenant (operativo)**: toda la data de negocio se filtra por `org_scope()`. El super admin ve exclusivamente el tenant que seleccionó; sin selección no ve nada (el `OrganizationContext` ya lo obliga a elegir con `requiereSeleccionOrg`).
2. **Plano plataforma (telemetría)**: sólo las 11 tablas de plataforma (`app_logs`, `alertas_sistema`, `nav_events`, `demo_leads`, `provisioning_log`, `organizations`, `planes`, `configuracion_global`, `role_change_log`, `email_send_log`, `auditoria_snapshots`) siguen siendo globales para el super admin, y sólo se consumen desde `/admin/*`.

### Fase 1 — Reescritura de políticas por lotes (migraciones)

Reemplazar en las 174 políticas el patrón

```text
organization_id = current_user_org_id() OR has_role(uid,'super_admin')
```

por

```text
organization_id = org_scope()
```

conservando intacta la parte de rol/capacidad de cada política (`es_admin_catalogo`, `has_any_role_efectivo`, SoD de CxP, etc.). Se hace en lotes por dominio para poder validar entre pasos:

- Lote A — Embarques y operaciones (embarques, conceptos, documentos, eventos, contenedores, garantías, tracking, notas, seguros)
- Lote B — Comercial (clientes, contactos, cotizaciones y costos, proformas, CRM, vendedora/comisiones)
- Lote C — Financiero CxC (facturas, conceptos_factura, pagos_factura y lotes, notas de crédito, cobranza, refacturaciones, estado de cuenta, series/folios)
- Lote D — Financiero CxP y tesorería (proveedores y su expediente, proveedor_facturas, anticipos, pagos_proveedor, bbva_movimientos, cuentas, traspasos, presupuesto)
- Lote E — Transversales (bitácora, auditoría de tenant, configuración, catálogos SAT, idempotency, client_users)

En cada lote también se ajusta el `WITH CHECK` de escritura al mismo `org_scope()`, de modo que un super admin sin tenant activo no pueda insertar filas huérfanas.

### Fase 2 — Espejo de esquema y guardrail de CI

- Actualizar los archivos espejo en `supabase/schema/**` de las políticas tocadas.
- Nuevo guardrail en `integrity-guard.sql`: falla si alguna tabla con columna `organization_id` tiene una política cuyo `qual`/`with_check` mencione `super_admin` junto a `current_user_org_id` (es decir, si vuelve a aparecer el "o eres super admin" sin acotar). La lista de tablas de plataforma queda como whitelist explícita.

### Fase 3 — Pruebas RLS

Nueva suite `supabase/tests/rls/test_rls_superadmin_scope.sql`:

- Super admin con tenant A activo: ve filas de A, **cero** filas de B, en las tablas representativas de cada lote.
- Super admin al cambiar a tenant B: se invierte el resultado.
- Super admin sin tenant activo: cero filas y escritura rechazada.
- Usuario normal de A: comportamiento sin cambios (regresión).
- Tablas de plataforma: el super admin las sigue viendo completas; un usuario normal no.

Se registra la suite en el runner de CI del grupo correspondiente.

### Fase 4 — Frontend

No requiere rediseño: las vistas operativas ya usan `useOrgActiva`/RLS y las de plataforma ya viven bajo `/admin`. Sólo se revisa que ninguna pantalla operativa consuma tablas de plataforma y que las consultas por id no asuman visibilidad global.

## Notas técnicas

- Cambio de comportamiento intencional: el super admin **sin** tenant seleccionado deja de ver datos de negocio (antes veía todo). Las pantallas de plataforma no se afectan.
- `org_scope()` es `STABLE SECURITY DEFINER` y ya está en uso en RPCs; no se toca su definición.
- Se respeta el endurecimiento H6 (`search_path`, `SECURITY DEFINER`) en cualquier función re-emitida.
- Al cerrar: `CHANGELOG.md` + bump de `APP_VERSION`.

## Riesgo principal

Es un cambio amplio de permisos. Se mitiga con lotes por dominio, suite RLS nueva antes de cerrar, y la ejecución completa de las suites RLS existentes (financiero, portales, refacturaciones, soft-delete) para detectar regresiones.
