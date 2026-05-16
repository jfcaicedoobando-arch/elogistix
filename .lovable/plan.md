# Plan — Endurecer Libre Carga para operación diaria

El proyecto ya tiene cimientos sólidos (RLS multi-tenant, capa hooks/services/lib, CI con knip + tests, controllers de página, auditoría arquitectónica, scan de seguridad limpio). Lo que sigue ahora **no es seguir refactorizando**, sino cerrar los huecos típicos cuando un MVP empieza a soportar dinero y operación real.

Lo agrupo en 6 frentes, en orden de impacto. Cada frente se puede ejecutar como una mini-ola independiente.

---

## 1. Resiliencia de datos (lo más urgente)

Si mañana alguien borra un embarque por error o se corrompe una factura, hoy no hay forma limpia de recuperar sin abrir Supabase a mano.

- **Backups verificados**: dejar documentado en `docs/operations.md` cómo restaurar un punto en el tiempo desde Lovable Cloud, y cada mes correr un *restore drill* en una org de staging.
- **Soft delete + bitácora de borrados**: hoy `eliminar_embarque_cascada` borra duro. Cambiar a `deleted_at timestamptz` en `embarques`, `cotizaciones`, `proformas`, `facturas`, `clientes`, con RLS que oculte filas con `deleted_at is not null` salvo a `admin/super_admin`. Pantalla "Papelera" con restore.
- **Idempotencia en mutaciones críticas**: facturación y consolidación de proformas deben ser idempotentes (cliente envía `request_id` UUID; la RPC lo guarda y rechaza duplicados). Evita doble factura por doble-click o reintento de red.
- **Constraints duros que faltan**: FKs reales hacia `clientes`, `embarques`, `cotizaciones`, `organizations` con `ON DELETE RESTRICT` en lugar de orfandad silenciosa; `CHECK` o trigger para `eta >= etd`, `total = subtotal + iva`, monedas válidas.
- **Snapshots financieros inmutables**: cuando una factura se emite, congelar tipo de cambio, IVA y conceptos en un JSONB `snapshot_emision`. Hoy si cambia la tasa o el catálogo, una factura ya emitida puede recalcularse incorrectamente al releerla.

## 2. Observabilidad y operación

Hoy si algo truena en producción te enteras porque te avisa el operador.

- **Error tracking real**: integrar Sentry (free tier) en `main.tsx` y en todas las edge functions. Captura stack + breadcrumbs + `organization_id` + `user_id`.
- **Logs estructurados en edge functions**: helper en `_shared/log.ts` que emita JSON con `level`, `fn`, `org_id`, `latency_ms`. Reemplazar `console.log` libres.
- **Health/status interno**: página `/admin/sistema` para super-admin con: última corrida del cron de auditoría, último snapshot, último tipo de cambio refrescado, conteo de errores Sentry últimas 24h, espacio usado en Storage por org.
- **Métricas de negocio expuestas**: KPIs operativos (embarques abiertos por estado, edad promedio de demoras, % proformas sin facturar > 7 días) ya existen — agregar alertas: si la métrica cruza umbral, mandar correo desde una edge function diaria.
- **Auditoría de cambios sensibles**: trigger genérico `log_table_change()` que grabe `before/after` en `bitacora_actividad` para `facturas`, `proformas`, `conceptos_costo`, `embarques.estado`. Hoy la bitácora captura acciones de UI; faltan los UPDATE directos.

## 3. Seguridad endurecida

El scan está limpio, pero quedan capas que aún no se aprietan.

- **Activar Password HIBP** en Auth (Lovable Cloud → Users → Auth Settings).
- **MFA obligatorio para `admin` y `super_admin**`: enrolamiento TOTP en pantalla de perfil; bloquear acciones sensibles si el rol es admin y no tiene MFA.
- **Política de contraseñas + expiración de sesiones**: min 12 chars, 12h de sesión activa, refresh 7 días.
- **Storage policies por path**: hoy se asume convención `<dominio>/<org_id>/...`. Agregar policies que **exijan** que el primer segmento del path coincida con una org del usuario; sin eso, un cliente con upload de portal podría escribir en otra org si el path es manipulable.
- **Edge functions admin → rate-limit suave**: tabla `rate_limit(user_id, fn, bucket_ts)` + check en `create-user`, `delete-user`, `invite-client-user` (máx 30/min por usuario). Previene abuso si una cookie se filtra.
- **Rotación de la llave service-role** documentada en `docs/security-checklist.md` (paso anual).
- **CSP + headers**: si publican en custom domain, añadir `Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` vía Lovable publish settings o meta-tags.

## 4. Calidad de datos en captura

La operación diaria genera basura si la UI no fuerza el dato correcto.

- **Zod en TODAS las mutaciones**: hoy hay validación en el wizard de embarque y cotización; falta endurecer Clientes (RFC con regex SAT), Proveedores, Contactos, Conceptos. Una `domain/validators.ts` con `rfcSchema`, `phoneSchema` (libphonenumber), `emailSchema`.
- **Catálogo único de incoterms, modos, monedas, tipos de carga**: ya existe parcial — auditar que ningún `<input>` libre permita un valor fuera del enum cuando el backend tiene el enum.
- **Deduplicación de clientes y proveedores en captura**: el `NuevoClienteDialog` debe consultar por RFC antes de crear y avisar "Ya existe un cliente con este RFC en tu organización".
- **Validación de coherencia**: triggers SQL que rechacen `factura.total <> subtotal + iva` o `embarque.eta < embarque.etd`.

## 5. Procesos y permisos de equipo

Con un equipo real entran y salen personas.

- **Onboarding/offboarding de usuarios**: checklist en `docs/operations.md`. UI: al desactivar un usuario, reasignar embarques abiertos a otro operador (modal con dropdown).
- **Roles más finos por módulo**: hoy `admin/operador/viewer/cliente`. Agregar `facturador` (sólo facturación + lectura del resto) y `comercial` (cotizaciones + clientes, sin operación ni facturación). Implementable como nuevos miembros del enum `app_role` + ajuste de policies con `has_role(...)`.
- **Aprobaciones de doble llave**: emisión de factura > $X o cancelación de proforma consolidada requiere segundo `admin` que confirme (tabla `aprobaciones_pendientes`, RPC `solicitar_aprobacion` + `aprobar`).
- **Notificaciones in-app**: campana en sidebar (tabla `notificaciones(user_id, tipo, payload, leido_at)`) — hoy las alertas viven en badges pero no hay historial.

## 6. Continuidad técnica

Para que esto siga vivo 2 años, no 2 meses.

- **CI más estricto**: subir `lint:unused:strict` a bloqueante (ya pasa sin findings). Agregar `tsc --noEmit` como job separado y coverage threshold mínimo 60% en `lib/` y `services/`.
- **Migraciones revisables**: convención de nombre `YYYYMMDD_HHMMSS_<verbo>_<tabla>.sql` (ya implícita) + un `docs/migrations-log.md` con racional de cada migración no trivial.
- **Versionado SemVer real**: hoy se bumpea con cada cambio en `appVersion.ts`. Mantenerlo, pero etiquetar releases (`v8.x.y` → tag git por la integración) y publicar `CHANGELOG.md` derivado de `changelogData.ts` para auditoría externa.
- **Documentación viva**: `docs/operations.md` (runbooks: cómo restaurar, cómo crear org, cómo desactivar usuario, cómo emitir factura manual si la RPC falla), `docs/onboarding.md` para nuevos devs.
- **Plan de carga**: probar con un dataset de 10k embarques + 100k conceptos en una org de staging. Hoy hay paginación servidor en listados, pero queda confirmar que reportes y operaciones siguen <2s con esa escala.

---

## Sugerencia de secuencia (4–6 olas)

1. **Ola A — Resiliencia** (frente 1 entero): soft-delete + snapshots inmutables + FKs/CHECKs + idempotencia. Es lo que más duele si pasa y lo que menos visible está hoy.
2. **Ola B — Observabilidad** (Sentry + logs estructurados + `/admin/sistema` + auditoría de UPDATE).
3. **Ola C — Seguridad de capa Auth** (HIBP, MFA admins, storage policies por path, rate-limit).
4. **Ola D — Calidad de captura** (Zod global + deduplicación + triggers de coherencia).
5. **Ola E — Procesos** (roles finos, aprobaciones, notificaciones, runbooks).
6. **Ola F — Continuidad** (CI estricto, prueba de carga, docs operativos).

---

## Notas técnicas

- Cambios de schema van por `supabase--migration`; muchos requieren ventana de mantenimiento corta (soft-delete migra datos existentes con `deleted_at = null` por default → sin downtime).
- Sentry y MFA son configurables sin riesgo de regresión; se pueden empezar mañana.
- Los frentes 1 y 4 introducen migraciones que deben probarse en staging antes de prod.
- Todo respeta las reglas Power of 10 y el flujo hooks → services → Supabase ya establecido.

¿Quieres que arranque por la **Ola A (resiliencia)**, o prefieres priorizar otro frente primero? También puedo desglosar cualquier ola en tareas atómicas listas para implementar.

haz un plan detallado solo para la OLA A