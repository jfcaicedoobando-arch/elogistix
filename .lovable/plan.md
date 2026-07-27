# Plan: Reparar suite RLS `storage_objects`

## Analogía
Es como probar la cerradura del casillero pero sin haber puesto tu chaqueta adentro: el guardia (RLS) no te deja pasar porque no encuentra tu nombre en la lista de dueños — no porque la cerradura falle, sino porque falta registrar el objeto en la tabla de dominio.

## Diagnóstico confirmado
La suite `RLS suite — storage_objects` es la única que falla en CI (línea 64 del test):

```
ERROR: RLS TEST FAIL: user_a (control) sí debe ver su objeto en org_a
```

Las otras cuatro suites (`isolation`, `anon_deny_all`, `roles_no_admin`, `financiero`) pasaron.

**Causa raíz.** La política `Tenant scoped read documentos` (bucket `documentos`) exige `EXISTS` contra `documentos_embarque JOIN embarques`:

```sql
EXISTS (
  SELECT 1 FROM documentos_embarque d JOIN embarques e ON e.id = d.embarque_id
  WHERE d.archivo = objects.name
    AND d.organization_id = current_user_org_id()
    AND e.organization_id = current_user_org_id()
)
```

El test siembra sólo `storage.objects` con path `org_a/emb-a/doc.pdf`, sin fila en `documentos_embarque` ni en `embarques`. Por eso el `EXISTS` retorna falso incluso para el dueño → `count = 0` → aserción de control falla.

Esta es la regla que documenta el memoria `Storage RLS Paths`: la validación de tenancy va vía EXISTS a la tabla de dominio, no por prefijo de carpeta. La suite quedó desalineada.

## Cambios

### 1. `supabase/tests/rls/test_rls_storage_objects.sql`
Antes de sembrar los objetos en storage, insertar en las tablas de dominio para que las policies encuentren el vínculo. Cambios acotados dentro del `DO $$`:

- Declarar `emb_a uuid`, `emb_b uuid`.
- Insertar dos filas en `public.embarques` (uno para cada org) con los mínimos requeridos por NOT NULL (organization_id, expediente, cliente_nombre — inspecciono el schema primero).
- Insertar dos filas en `public.documentos_embarque` con `archivo = path_a` / `path_b`, `organization_id` correspondiente, `embarque_id` correspondiente.
- Mantener el resto del test intacto (los 3 asserts).

Si el esquema de `embarques` tiene NOT NULLs adicionales o triggers de negocio (autogeneración de expediente, validaciones de fecha), esos también deben cumplirse. Voy a leer `information_schema` para `embarques` y `documentos_embarque` antes de escribir la migración de fixtures.

### 2. Test alternativo si el fixture es inviable
Si sembrar `embarques` explota por triggers complicados (por ejemplo `_audit_embarques_agregar`, generación de folio), la alternativa mínima es reducir el test a que el owner **postgres/service_role** vea el objeto y verificar sólo la denegación cruzada de `user_b`. Esto degrada la cobertura, así que primero intento el fixture completo.

### 3. Versionado
- `APP_VERSION` → `13.320.17`.
- Entrada en `CHANGELOG.md` bajo Fixed: descripción del fixture y la razón (política EXISTS contra tabla de dominio).

## Fuera de alcance
- No cambiar las políticas de `storage.objects`. Son correctas: exigir vínculo a tabla de dominio es la postura de seguridad deseada (referida en `mem://technical/storage-rls-paths`).
- No tocar las otras 4 suites RLS ni el workflow de CI.
