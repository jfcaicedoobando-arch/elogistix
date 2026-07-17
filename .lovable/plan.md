# Auditoría multi-tenant de Libre Carga

## TL;DR

- **Aislamiento de datos entre orgs: correcto.** No encontré ninguna política RLS activa ni RPC vigente que permita a una org leer/escribir datos de otra. Todos los hallazgos históricos de fuga cross-org (defaults con UUID de Elogistix, RPCs `profit_*`, `busqueda_global` sin filtro) **ya fueron corregidos** en migraciones posteriores; hoy filtran por `current_user_org_id() OR has_role('super_admin')`.
- **Pero una org nueva NO empieza desde 0 funcional.** No hay trigger `AFTER INSERT ON organizations` que siembre los catálogos obligatorios. Y sólo un `super_admin` (rol que hoy sólo tienen usuarios de Elogistix) puede crear la org y asignarle su primer miembro.

Analogía: los "cuartos" de cada org están bien cerrados con llave (RLS), pero **el cuarto llega vacío** — sin folios, sin pipeline CRM, sin categorías, sin credenciales de facturación — y **sólo el conserje de Elogistix tiene la llave maestra** para amueblarlo.

---

## Hallazgos (por severidad)

### ALTO — bloquean operar una org nueva

**H1. No hay auto-provisioning al crear una organización**
`src/features/admin/services/organizations.ts:31` hace `INSERT` plano en `organizations`. No existe trigger ni Edge Function que siembre lo que una org necesita para operar:


| Tabla                                    | Qué pasa sin seed                              |
| ---------------------------------------- | ---------------------------------------------- |
| `folio_secuencias`                       | Se crea sola al primer folio (OK, ya blindado) |
| `factura_series`                         | ❌ No puede emitir facturas                     |
| `configuracion` / `configuracion_global` | ❌ Sin config base (IVA, moneda, etc.)          |
| `crm_etapas_pipeline`                    | ❌ CRM inutilizable                             |
| `crm_motivos_perdida`                    | ❌ No puede cerrar oportunidades perdidas       |
| `presupuesto_categorias`                 | ❌ Presupuesto vacío                            |
| `facturapi_credenciales`                 | ❌ No timbra                                    |
| `vendedora_config`                       | ❌ Sin firma/config de vendedor                 |


**H2. Alta del primer usuario/owner es manual y requiere super_admin de Elogistix**
Políticas `INSERT` en `organizations` y `organization_members` sólo permiten a `has_role(auth.uid(),'super_admin')`. El wizard `NuevaOrganizacionDialog` no pide un usuario dueño ni lo enlaza. Consecuencia: **no hay self-service**; la org nueva depende de que alguien de Elogistix la habilite y le asigne su primer admin.

### MEDIO

**H3. Patrón riesgoso de default hardcodeado en migraciones antiguas**
`20260326215454...sql:5-19` puso `DEFAULT '00000000-0000-0000-0000-000000000001'` en `organization_id` de 14 tablas. Ya sobrescrito por `current_user_org_id()` el mismo día, pero si se copia como plantilla para tablas nuevas, reintroduce el hardcode.

**H4. Tabla `_backup_conceptos_venta_elimp00195_20260706` sin RLS explícito**
Es un backup puntual, pero conviene dropearla o habilitarle RLS.

### OK (verificado)

- RLS habilitado y filtrado por org en ~90 tablas operativas (embarques, cotizaciones, facturas, clientes, proveedores, conceptos_*, cobranza, crm_*, presupuesto_*, comisiones, tracking, facturapi_credenciales, folio_secuencias, etc.).
- RPCs analíticas (`profit_*`, `busqueda_global`, `cxp_*`, `cartera_pendiente`, `facturacion_por_emitir`) filtran por org o son `SECURITY INVOKER` (heredan RLS).
- Folios per-org atómicos (blindaje `v13.301.49` ya aplicado).
- Referencias a "Elogistix" en frontend/edge functions son marca/plantillas/tests, no filtros duros.

### Pendientes de auditar (no cubiertos aún)

- **Edge Functions con `service_role**` (`facturapi-*`, `tracking-public`, `process-email-queue`): `service_role` bypasa RLS por diseño; hay que confirmar que cada handler valida `organization_id` desde el JWT.
- **Storage buckets**: convención de path `{organization_id}/...` y políticas de `storage.objects`.
- **Drift**: comparar `pg_policies` en vivo vs. migraciones del repo.

---

## Plan de remediación propuesto

Divido en 3 fases. Cada una es opcional/independiente; me confirmas cuál(es) quieres que ejecute en modo build.

### Fase 1 — Auto-provisioning de orgs nuevas (resuelve H1)

Nueva migración `provision_new_organization`:

1. Función `public.handle_new_organization()` `SECURITY DEFINER` que, al insertarse una fila en `organizations`, siembre por `NEW.id`:
  - `factura_series` (serie `A` con folio 1)
  - `configuracion` (IVA 16%, moneda MXN, etc. clonado de defaults globales)
  - `crm_etapas_pipeline` (7 etapas estándar)
  - `crm_motivos_perdida` (catálogo default)
  - `presupuesto_categorias` (set base)
  - `vendedora_config` (fila vacía lista para editar)
  - `folio_secuencias` (ya se auto-crea, se explicita en 0)
2. Trigger `AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE handle_new_organization()`.
3. `facturapi_credenciales` NO se siembra (requiere API key real del cliente).
4. Backfill idempotente para orgs existentes que no tengan alguno de estos seeds.

### Fase 2 — Self-service de owner (resuelve H2)

Opción A (mínima, recomendada): Edge Function `provision-organization` que, en una sola transacción:

1. Crea la `organizations`.
2. Crea `organization_members` con `role='admin'` para `auth.uid()` invocante.
3. Devuelve el `organization_id`.

Ajusta el wizard `NuevaOrganizacionDialog` para llamarla en vez del INSERT directo. Mantiene la restricción `super_admin` para orgs creadas desde el panel Elogistix, pero abre la puerta a self-service futuro cambiando sólo el gate.

### Fase 3 — Blindaje preventivo (resuelve H3, H4 y pendientes)

1. Test de arquitectura `tests/architecture/no-hardcoded-elogistix.test.ts` que grepa migraciones nuevas y falla si detecta `DEFAULT '00000000-0000-0000-0000-000000000001'`.
2. Test `tests/rls/nueva-org-puede-operar.sql` que crea una org temporal, un usuario admin, y verifica que puede: crear cliente → cotización → embarque → factura sin datos preexistentes.
3. Drop de `_backup_conceptos_venta_elimp00195_20260706` (o `ENABLE RLS` si aún se necesita).
4. Auditoría follow-up de Edge Functions y Storage (pendiente H5/H6).

---

## Preguntas para ti

1. **¿Ejecuto las 3 fases o sólo la Fase 1** (auto-provisioning, que es la más importante y de menor riesgo)?
2. Para los seeds de la Fase 1, **¿quieres que copie los valores actuales de Elogistix como plantilla** (etapas CRM, categorías de presupuesto, config de IVA), o prefieres una plantilla neutra "de fábrica"? neutra de fabrica
3. **Fase 2**: ¿self-service abierto (cualquier usuario autenticado puede crear su org) o sigue restringido a `super_admin` pero al menos automatizando el alta del owner? Solo el super admin puede crear orgs nuevas a travez de su panel
  &nbsp;