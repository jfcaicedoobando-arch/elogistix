# Runbook de operaciones — Libre Carga

Documento operativo para respaldos, restauración y procedimientos manuales sobre
la base de datos administrada por Lovable Cloud (Supabase). Mantener junto a
`docs/security-checklist.md`. Aplica a entornos **Test** y **Live**.

> **Audiencia:** super_admin de la plataforma. Todas las acciones destructivas
> requieren confirmación explícita y quedan en `bitacora_actividad`.

---

## 1. Modelo de respaldos

Lovable Cloud ejecuta respaldos administrados sobre la instancia Postgres:

| Tipo | Frecuencia | Retención | Quién lo dispara |
|---|---|---|---|
| **Snapshot diario** (full) | Cada 24h (~03:00 UTC) | 7 días rolling | Plataforma (automático) |
| **WAL continuo (PITR)** | Streaming | 7 días rolling | Plataforma (automático) |
| **Snapshot lógico de auditoría** | Diario 06:00 MX | 90 días en tabla `auditoria_snapshots` | Edge function `auditoria-snapshot-daily` (cron) |
| **Export manual previo a migración riesgosa** | Bajo demanda | Indefinido (drive interno) | Operador (manual, ver §4) |

**Punto de Recuperación (RPO):** ≤ 5 minutos (gracias a WAL continuo).
**Tiempo de Recuperación (RTO):** ≤ 30 minutos para PITR; ≤ 2h para restore lógico.

---

## 2. Verificación diaria de salud

Correr **cada mañana laboral** desde el editor SQL de Lovable Cloud el script:

```bash
scripts/db/health-check.sql
```

Devuelve por tabla operativa: `n_filas`, `n_huerfanas`, `n_borradas_logicas`,
`tamano_mb`. Comparar contra el valor del día anterior.

**Alerta si:**
- `n_huerfanas > 0` en cualquier tabla → reportar antes de cualquier otra acción.
- `n_filas` cae más de 5% sin liberación operativa que lo justifique.
- `tamano_mb` crece >20% día a día (revisar `documentos_embarque` y logs).

Adicionalmente, revisar `auditoria_snapshots` del día actual:

```sql
select organization_id, fecha, total_embarques, total_facturas, total_proformas
from auditoria_snapshots
where fecha = current_date;
```

Si falta alguna organización activa, re-ejecutar manualmente:

```sql
select auditoria_capturar_snapshot(p_organization_id => '<uuid_org>');
```

---

## 3. Restore Point-In-Time (PITR)

Procedimiento ante corrupción, borrado masivo o migración fallida.

### 3.1 Pre-requisitos
- Acceso super_admin a Lovable Cloud.
- Timestamp UTC exacto del último estado bueno (revisar `bitacora_actividad`
  para identificar el evento previo al daño).
- Ventana de mantenimiento comunicada por canal interno (al menos 15 min).

### 3.2 Pasos
1. **Congelar escrituras**: comunicar a operadores que se detendrá la app
   ~15 min y poner banner de mantenimiento (deshabilitar login temporalmente
   desactivando organización principal: `update organizations set activo=false
   where id=...;`).
2. **Snapshot defensivo**: en el panel de Cloud → Database → Backups, generar
   un snapshot manual etiquetado `pre-restore-YYYYMMDDHHMM`.
3. **Iniciar PITR**: Cloud → Database → Backups → Point in time → seleccionar
   timestamp UTC objetivo → confirmar. Lovable Cloud restaura la instancia
   completa al instante elegido (RPO ≤ 5 min).
4. **Esperar healthy**: la instancia pasa por `RESTORING` → `COMING_UP` →
   `ACTIVE_HEALTHY`. No iniciar consultas hasta `ACTIVE_HEALTHY`.
5. **Verificación post-restore** (obligatoria):
   ```sql
   -- conteo total vs snapshot pre-incidente
   \i scripts/db/health-check.sql
   -- contra auditoria_snapshots del día previo al daño
   select * from auditoria_snapshots where fecha = '<YYYY-MM-DD>';
   -- sanity check de RLS
   select count(*) from embarques;        -- como super_admin
   ```
6. **Reabrir escrituras**: `update organizations set activo=true where id=...;`
   y quitar banner.
7. **Registrar incidente** en `bitacora_actividad`:
   ```sql
   insert into bitacora_actividad(organization_id, modulo, accion, detalle, usuario_email)
   values('<uuid_org>', 'operaciones', 'restore_pitr',
          jsonb_build_object('timestamp_restaurado','<UTC>','motivo','...'),
          '<correo_operador>');
   ```

### 3.3 Reversión
Si tras el restore se detecta que se perdió información posterior válida,
recuperar desde el snapshot defensivo del paso 2 vía export lógico (§4) y
re-insertar selectivamente con `supabase--insert`.

---

## 4. Export lógico manual (pre-migración riesgosa)

Antes de cualquier migración que altere o elimine columnas con datos:

```bash
# desde una máquina con acceso a la URL de pooler Cloud
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --schema=public \
  --file=elogistix_$(date +%Y%m%d_%H%M).backup \
  "$DATABASE_URL"
```

Subir el archivo `.backup` al drive operativo interno bajo
`backups/manuales/AAAA-MM/`. Conservar mínimo 90 días.

Restore selectivo (sólo una tabla):

```bash
pg_restore --data-only --table=facturas \
  --dbname="$DATABASE_URL_STAGING" elogistix_20260516_0830.backup
```

> Nunca restaurar `--clean` contra producción. Siempre staging primero.

---

## 5. Restore drill mensual

Primer lunes de cada mes el operador on-call ejecuta el simulacro:

1. Generar PITR a un timestamp de las últimas 6h **en la instancia Test**
   (nunca Live).
2. Correr `scripts/db/health-check.sql` y comparar contra
   `auditoria_snapshots` del día.
3. Verificar que el login con cuenta demo funciona (ver
   `mem://features/demo-trial-access`).
4. Documentar en `bitacora_actividad` con `accion='restore_drill_mensual'` y
   tiempo total transcurrido.
5. Si RTO > 30 min, abrir incidente en el repo y escalar a Lovable.

---

## 6. Procedimientos manuales de respaldo

### 6.1 Emisión de factura manual (si la RPC falla)

Cuando `crear_factura_desde_proforma` rechaza por bug, emitir a mano respetando
el snapshot inmutable (Ola A.4):

```sql
-- 1) crear la factura en estado Borrador
insert into facturas(
  organization_id, cliente_id, embarque_id, proforma_id,
  numero, moneda, subtotal, iva, total, tipo_cambio,
  fecha_emision, fecha_vencimiento, expediente, estado
)
values(
  '<uuid_org>', '<uuid_cliente>', '<uuid_embarque>', '<uuid_proforma>',
  'F-2026-XXXX', 'MXN', 10000.00, 1600.00, 11600.00, 1.00,
  current_date, current_date + interval '30 days', 'EXP-...', 'Borrador'
)
returning id;

-- 2) copiar conceptos desde la proforma
insert into conceptos_factura(factura_id, descripcion, cantidad, precio_unitario, total, moneda)
select '<uuid_factura_recien_creada>', descripcion, cantidad, precio_unitario, total, moneda
from conceptos_venta where proforma_id = '<uuid_proforma>';

-- 3) emitir (el trigger congela snapshot_emision automáticamente)
update facturas set estado='Emitida' where id='<uuid_factura>';

-- 4) verificar snapshot
select snapshot_emision is not null as congelada
from facturas where id='<uuid_factura>';
```

### 6.2 Desactivar usuario y reasignar embarques

```sql
-- 1) desactivar la membresía
update organization_members
set activo = false
where user_id = '<uuid_user>' and organization_id = '<uuid_org>';

-- 2) reasignar embarques en curso al nuevo operador
update embarques
set operador_email = '<correo_nuevo>'
where operador_email = '<correo_saliente>'
  and organization_id = '<uuid_org>'
  and estado not in ('Entregado','Cancelado');

-- 3) registrar en bitácora
insert into bitacora_actividad(organization_id, modulo, accion, detalle, usuario_email)
values('<uuid_org>','usuarios','reasignar_operador',
       jsonb_build_object('de','<correo_saliente>','a','<correo_nuevo>'),
       '<correo_super_admin>');
```

### 6.3 Crear nueva organización (seed mínimo)

Preferir el flujo UI: **/admin → Nueva organización**. Si la UI falla:

```sql
-- 1) organización
insert into organizations(nombre, rfc, plan_id, activo)
values('Nueva Empresa SA', 'XAXX010101000', '<uuid_plan>', true)
returning id;

-- 2) membresía del primer admin (debe existir ya en auth.users)
insert into organization_members(organization_id, user_id, rol, activo)
values('<uuid_org_nueva>', '<uuid_user_admin>', 'admin', true);

-- 3) configuración por defecto
insert into configuracion(organization_id, tasa_iva, moneda_base)
values('<uuid_org_nueva>', 0.16, 'MXN');
```

Verificar que el nuevo admin puede entrar y ver dashboard vacío sin errores
RLS antes de invitar más usuarios.

---

## 7. Escalamiento

| Síntoma | Acción inmediata |
|---|---|
| `cloud_status` distinto de `ACTIVE_HEALTHY` >10 min | Esperar; si persiste, abrir ticket Lovable |
| Restore drill mensual con RTO > 30 min | Issue + escalar |
| `n_huerfanas > 0` en health-check | Detener migraciones; investigar bitacora del día |
| Trigger `bloquear_modificacion_factura_emitida` dispara `factura_inmutable` legítimo | Emitir nota de crédito (no tocar trigger) |
| Pérdida confirmada de datos > RPO | PITR (§3) + comunicado a clientes afectados |

---

## 8. Memoria y mantenimiento del runbook

- Revisar este documento **cada release mayor** (8.x.0).
- Actualizar la tabla §1 si Lovable Cloud cambia política de retención.
- Cualquier procedimiento nuevo ejercido en incidente real debe agregarse aquí
  en menos de 7 días post-mortem.
