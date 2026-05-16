# Plan detallado — Ola A: Resiliencia de datos

Objetivo: que ningún error humano, doble-click o cambio de catálogo pueda corromper o perder datos operativos/financieros. Cinco entregables independientes, en orden de menor a mayor riesgo de regresión. Cada entregable es una mini-versión `8.x.y` con su migración, su código y sus tests.

---

## A.1 — Constraints duros y FKs faltantes (versión 8.157.0)

**Por qué primero:** es el cambio más barato, sin UI, y descubre datos inconsistentes que las siguientes etapas darían por buenos.

**Migración SQL:**

1. Auditoría previa (sólo lectura, antes de migrar):
   ```sql
   -- huérfanos por dominio
   select 'embarques sin cliente' as tipo, count(*) from embarques e
     left join clientes c on c.id = e.cliente_id where c.id is null;
   select 'conceptos_costo sin embarque', count(*) from conceptos_costo cc
     left join embarques e on e.id = cc.embarque_id where e.id is null;
   -- coherencia financiera
   select count(*) from facturas where round(subtotal + iva, 2) <> round(total, 2);
   select count(*) from embarques where eta is not null and etd is not null and eta < etd;
   ```
   Si aparecen filas, se corrigen con `supabase--insert` antes de añadir el constraint (no se descartan).

2. FKs con `ON DELETE RESTRICT` donde hoy hay UUID suelto:
   - `embarques.cliente_id` → `clientes.id`
   - `embarques.cotizacion_id` → `cotizaciones.id` (`ON DELETE SET NULL`)
   - `conceptos_costo.embarque_id` → `embarques.id`
   - `conceptos_costo.proveedor_id` → `proveedores.id` (`ON DELETE SET NULL`)
   - `conceptos_venta.embarque_id` → `embarques.id`
   - `conceptos_venta.proforma_id` → `proformas.id` (`ON DELETE SET NULL`)
   - `documentos_embarque.embarque_id`, `notas_embarque.embarque_id`, `eventos_embarque.embarque_id` → `embarques.id` (`ON DELETE CASCADE`)
   - `facturas.embarque_id` → `embarques.id` (`RESTRICT`), `facturas.cliente_id` → `clientes.id` (`RESTRICT`), `facturas.proforma_id` → `proformas.id` (`SET NULL`)
   - `proformas.cliente_id`, `proformas.embarque_id`
   - `contactos_cliente.cliente_id` → `clientes.id` (`CASCADE`)
   - `client_users.cliente_id` → `clientes.id` (`CASCADE`)
   - `organization_members.organization_id` → `organizations.id` (`CASCADE`)
   - `cotizacion_costos.cotizacion_id` → `cotizaciones.id` (`CASCADE`)
   - `auditoria_revisiones.embarque_id` → `embarques.id` (`CASCADE`); `auditoria_comentarios.revision_id` → `auditoria_revisiones.id` (`CASCADE`)

3. CHECKs de dominio (cuando no rompen históricos):
   - `embarques`: `check (eta is null or etd is null or eta >= etd)`
   - `embarques`: `check (peso_kg >= 0 and volumen_m3 >= 0 and piezas >= 0)`
   - `facturas`: `check (subtotal >= 0 and iva >= 0 and total >= 0)`
   - `conceptos_costo`: `check (monto >= 0)`
   - `conceptos_venta`: `check (precio_unitario >= 0 and cantidad > 0)`
   - `clientes`: `check (dias_credito is null or dias_credito >= 0)`

4. Índices que faltan y duelen en producción:
   - `idx_embarques_org_estado_etd (organization_id, estado, etd desc)`
   - `idx_embarques_cliente_etd (cliente_id, etd desc)`
   - `idx_facturas_org_estado_fecha (organization_id, estado, fecha_emision desc)`
   - `idx_proformas_org_estado_emision (organization_id, estado_proforma, fecha_emision desc)`
   - `idx_conceptos_costo_embarque (embarque_id)` y `_venta (embarque_id)`
   - `idx_bitacora_org_created (organization_id, created_at desc)`

**Código:** ninguno (sólo schema). Verificar con `tsc --noEmit` y `bun run test` por si algún test inserta filas que violan los nuevos checks.

**Tests:** snapshot de los `pg_indexes` y `pg_constraint` nuevos en `docs/migrations-log.md`.

---

## A.2 — Soft delete con papelera (versión 8.158.0)

**Tablas con `deleted_at`:** `embarques`, `cotizaciones`, `proformas`, `facturas`, `clientes`, `proveedores`, `contactos_cliente`, `conceptos_costo`, `conceptos_venta`, `documentos_embarque`.

**Migración:**

1. `alter table <t> add column deleted_at timestamptz null;`
2. `alter table <t> add column deleted_by uuid null;`
3. Índice parcial: `create index idx_<t>_alive on <t>(organization_id) where deleted_at is null;`
4. Reescribir las policies `SELECT` de cada tabla para excluir filas borradas salvo `super_admin` o `admin` en modo papelera (parámetro `?papelera=true`):
   ```sql
   using (
     ((organization_id = current_user_org_id()) or has_role(auth.uid(), 'super_admin'))
     and (deleted_at is null or has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'super_admin'))
   )
   ```
5. RPCs nuevas (atómicas, `security definer`):
   - `soft_delete_<entidad>(_id uuid, _motivo text)` → set `deleted_at = now(), deleted_by = auth.uid()`, registra en `bitacora_actividad` (módulo `papelera`, acción `borrar_<entidad>`).
   - `restaurar_<entidad>(_id uuid)` → set `deleted_at = null`, registra `restaurar_<entidad>`.
   - `purgar_<entidad>(_id uuid)` → hard delete real, sólo `super_admin`, registra `purgar_<entidad>`.
6. Reemplazar `eliminar_embarque_cascada` por `soft_delete_embarque` que también marca documentos/notas/eventos/conceptos hijos.

**Código frontend:**

- `src/services/papelera/index.ts` (nuevo): `softDelete`, `restaurar`, `purgar`, `listarPapelera(entidad, page, pageSize)`.
- `src/hooks/papelera/index.ts` con `usePapelera`, `useRestaurar`, `usePurgar` (invalida la lista del dominio).
- Hooks de mutación existentes (`useEmbarques.useDeleteEmbarque`, `useDeleteCliente`, `useDeleteCotizacion`, `useDeleteFactura`, `useDeleteProforma`, `useDeleteProveedor`) cambian a llamar `softDelete`. El doble-confirm "ELIMINAR" se mantiene (mem `data-safety-confirmations`).
- Página nueva `src/pages/admin/Papelera.tsx` con tabs por entidad, columnas `nombre`, `eliminado_por`, `eliminado_at`, acciones "Restaurar" y "Purgar definitivo" (sólo super_admin, doble confirmación con typing "PURGAR").
- Item de sidebar para admin: "Papelera" bajo Administración.
- Filtros de listados: por defecto excluyen borrados. Las queries existentes ya no traen `deleted_at not null` porque la RLS lo filtra; no se requiere cambio en services salvo añadir la columna a los `SELECT` cuando se navegue desde papelera.

**Tests:** unitarios en `papelera.service.test.ts` mockeando supabase; integración en una org de staging con embarque + factura asociada (debe bloquear borrado si tiene factura emitida, regla negocio).

---

## A.3 — Idempotencia en mutaciones críticas (versión 8.159.0)

**Alcance:** RPCs `crear_proforma_con_conceptos`, `consolidar_proformas`, `crear_factura_desde_proforma`, `crear_embarque_con_conceptos`, `actualizar_estado_embarque`.

**Migración:**

1. Tabla nueva:
   ```sql
   create table public.idempotency_keys (
     key uuid primary key,
     organization_id uuid not null,
     user_id uuid not null,
     fn text not null,
     response_id uuid,
     created_at timestamptz default now()
   );
   create index idx_idem_user_created on idempotency_keys(user_id, created_at desc);
   -- TTL: trigger o cron que purge >7 días
   ```
2. Cada RPC crítica recibe parámetro `_request_id uuid` y al inicio:
   ```sql
   insert into idempotency_keys(key, organization_id, user_id, fn)
   values (_request_id, current_user_org_id(), auth.uid(), '<fn>')
   on conflict (key) do nothing
   returning 1;
   if not found then
     return (select response_id from idempotency_keys where key = _request_id);
   end if;
   ```
3. Al terminar, `update idempotency_keys set response_id = <id_nuevo> where key = _request_id`.
4. Cron `purge_idempotency_keys_daily` borra >7 días.

**Código frontend:**

- `src/lib/idempotency.ts` (nuevo): `newRequestId(): string` (crypto.randomUUID).
- Hooks de mutación generan `requestId` con `useRef` al montar el formulario y lo reusan en reintentos; lo resetean tras `onSuccess`.
- Services correspondientes incluyen el `_request_id` en cada `.rpc(...)`.

**Tests:** unit tests del hook simulan doble dispatch consecutivo y verifican una sola creación (mock de RPC que registra calls).

---

## A.4 — Snapshots financieros inmutables (versión 8.160.0)

**Tablas afectadas:** `facturas`, `proformas`, `proforma_conceptos_consolidados`, `conceptos_venta` (los que tributen).

**Migración:**

1. `alter table facturas add column snapshot_emision jsonb null;`
2. `alter table proformas add column snapshot_emision jsonb null;`
3. Trigger `congelar_factura_al_emitir` antes de pasar a estado `Emitida` o `Pagada`:
   ```sql
   new.snapshot_emision := jsonb_build_object(
     'tasa_iva', new.iva / nullif(new.subtotal, 0),
     'tipo_cambio', new.tipo_cambio,
     'conceptos', (select jsonb_agg(row_to_json(cf)) from conceptos_factura cf where cf.factura_id = new.id),
     'cliente_snapshot', (select jsonb_build_object('nombre', nombre, 'rfc', rfc, 'direccion', direccion) from clientes where id = new.cliente_id),
     'organizacion_snapshot', (select jsonb_build_object('nombre', nombre, 'rfc', rfc) from organizations where id = new.organization_id),
     'congelado_at', now()
   );
   ```
4. Trigger equivalente en `proformas` cuando `estado_proforma` pasa a `aprobada` o `facturada`.
5. Trigger `bloquear_modificacion_factura_emitida`: si `OLD.snapshot_emision is not null` y cambia algo distinto a `factura_pdf_url`, `factura_xml_url`, `notas`, lanza `RAISE EXCEPTION 'factura_inmutable'`.

**Código frontend:**

- `services/facturacion/queries.ts`: nueva función `fetchFacturaSnapshot(id)` para PDF y reimpresión.
- `generators/facturaPdf.ts` (o `proformaPdf.ts`): cuando `snapshot_emision` existe, generar el PDF desde el snapshot — nunca desde la fila viva. Así el PDF del 2024 sigue saliendo con la tasa del 2024 aunque cambie IVA hoy.
- Mensajes de error: añadir `factura_inmutable` al `errorCatalog` con texto "Esta factura está emitida y no puede modificarse. Para corregir, emite una nota de crédito.".

**Tests:** `lib/financial/__tests__/snapshot.test.ts` verifica que dado un snapshot, el cálculo de re-render produce los mismos totales aunque la tasa global cambie.

---

## A.5 — Runbook de backup/restore y restore drill (versión 8.161.0)

Documentación operacional, no código.

**Entregables:**

1. `docs/operations.md` con secciones:
   - **Restore point-in-time** desde Lovable Cloud paso a paso (con screenshots por ahora descritos en texto).
   - **Restore drill mensual** (script SQL de verificación que cuenta filas por tabla post-restore y las compara con `auditoria_snapshots`).
   - **Emisión de factura manual** si la RPC falla (insertar fila + concepto + congelar snapshot a mano, con SQL listo).
   - **Desactivar usuario y reasignar embarques** (modal en UI + query SQL de respaldo).
   - **Crear nueva organización** (UI super-admin + verificación de seed mínimo).
2. `scripts/db/health-check.sql`: query única que devuelve por tabla `n_filas`, `n_huérfanas`, `n_borradas_logicas`, `tamaño_mb`. Útil tras un restore.
3. Item en `Audit Pendings` (memoria) marcando lo que queda fuera de esta ola.

---

## Cómo se entrega

- Una versión por sub-entregable (A.1 → 8.157.0, A.2 → 8.158.0, …) con su entrada en `Changelog.tsx`, `chunk0.ts`, `changelogData.ts` y bump en `appVersion.ts`.
- Cada migración va sola por `supabase--migration`, sin combinarse con código de UI en el mismo paso (regla del sistema sobre migraciones + tipos).
- Verificación obligatoria en cada paso: `bunx tsc --noEmit`, `bun run test`, `bun run build`, `bun run lint:unused`. Sólo cierro la sub-versión si los cuatro pasan.
- Tras A.2 y A.4 se actualizan las memorias correspondientes (`mem://features/data-safety-confirmations` añade soft-delete, nueva `mem://features/snapshots-financieros`).

## Orden de implementación inmediato

Arranco con **A.1** porque es 100% schema, no toca UI y desbloquea ver datos inconsistentes ya existentes antes de meter soft-delete. Si en la auditoría previa aparecen huérfanos, los reporto y pido criterio antes de borrar/reasignar.

¿Procedo con A.1 ahora mismo o quieres revisar/ajustar algo del alcance?
