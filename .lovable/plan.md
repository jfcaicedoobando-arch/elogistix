## Contexto

Antes de planear, audité el estado real. Hallazgos:

1. **Las políticas de `embarques` y `cotizaciones` ya son multitenant**, vía `organization_id = current_user_org_id()` (SECURITY DEFINER que resuelve la org del usuario logueado). El patrón correcto del proyecto NO es `current_setting('app.current_org_id')` — eso requeriría setear un GUC por request que el cliente Supabase no envía. Mantenemos `current_user_org_id()`.
2. **La columna se llama `organization_id`**, no `org_id`. No se renombra (rompería ~50 tablas, todos los hooks y el RPC `get_embarque_full`).
3. **Las 67 tablas de `public` tienen RLS habilitado.** De las 53 tablas con `organization_id`, todas tienen al menos una política con filtro por org o por rol. Las 14 sin `organization_id` son catálogos públicos (`puertos`, `navieras`, `planes`, `tipos_contenedor`), tablas de servicio (`email_send_*`, `ratelimit_buckets`, `suppressed_emails`, `tracking_webhook_log`) o globales (`organizations`, `user_roles`, `configuracion_global`) — todas correctas.

## Anomalías a corregir (defense in depth)

Dos tablas tienen `organization_id` en la columna pero sus SELECT solo filtran por `auth.uid()` sobre el dueño directo. Si por un bug de aplicación se insertara una notificación con `usuario_id` correcto pero `organization_id` de otra org, podría leerse. Añadimos filtro redundante por org:

| Tabla | Política actual SELECT | Política propuesta SELECT |
|---|---|---|
| `notificaciones_internas` | `usuario_id = auth.uid()` | `usuario_id = auth.uid() AND organization_id = current_user_org_id()` |
| `crm_notificaciones` | `user_id = auth.uid()` | `user_id = auth.uid() AND organization_id = current_user_org_id()` |

UPDATE policies reciben el mismo refuerzo. Las INSERT existentes (que ya validan `organization_id = current_user_org_id()` vía WITH CHECK del trigger general) no se tocan.

## No se cambia

- Políticas de `embarques`, `cotizaciones`, `clientes`, `facturas`, `conceptos_*`, etc. — ya están correctas.
- Políticas del portal cliente (`Cliente read own ...`): filtran por `cliente_id IN current_user_client_ids()`. NO se les añade `organization_id = current_user_org_id()` porque los contactos-usuario del portal no están en `user_organization_members` y devolvería NULL, rompiendo el portal. El aislamiento por `cliente_id` ya es suficiente: un cliente solo pertenece a una organización.
- Políticas de `service_role` en tablas de email — correctas para edge functions.

## Entregables

1. **Migración** que reemplaza las 4 políticas de `notificaciones_internas` y `crm_notificaciones` (DROP + CREATE de los 4 policies SELECT/UPDATE, con el filtro redundante de org).
2. **Nuevo documento** `docs/rls-multitenant-audit.md` con la matriz auditada (tabla / tiene `organization_id` / # políticas / patrón usado) — sirve para futuras auditorías trimestrales referenciadas en `docs/security-checklist.md`.
3. **Extender** `supabase/tests/rls/test_rls_isolation.sql` con 2 casos: usuario de Org A NO ve `notificaciones_internas` ni `crm_notificaciones` de Org B aunque tuvieran su `usuario_id` (simulando bug).
4. **CHANGELOG.md** + bump `APP_VERSION` a `12.61.11` con bullet:  
   `Endurece RLS de notificaciones (internas y CRM) con filtro redundante por organization_id; resto de tablas auditadas y conformes.`

## Detalles técnicos

SQL de la migración (resumen):

```sql
DROP POLICY "Users read own notifications" ON public.notificaciones_internas;
CREATE POLICY "Users read own notifications" ON public.notificaciones_internas
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() AND organization_id = current_user_org_id());

DROP POLICY "Users update own notifications" ON public.notificaciones_internas;
CREATE POLICY "Users update own notifications" ON public.notificaciones_internas
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() AND organization_id = current_user_org_id())
  WITH CHECK (usuario_id = auth.uid() AND organization_id = current_user_org_id());

-- mismo patrón para crm_notificaciones (user_id en lugar de usuario_id)
```

Sin GRANT nuevos (las tablas ya los tienen). Sin cambios de schema. Cero impacto en código TypeScript (los hooks ya filtran por `organization_id` en sus queries; el RLS extra solo es defensa).
