# Checklist QA — Release Candidate

> Versión objetivo: **12.0.0-rc.1** · Base: 11.70.0
> Modo de uso: marcar PASS / FAIL / N/A junto a cada ítem antes de cortar el RC.
> Un FAIL en cualquier flujo crítico bloquea el corte.

## A. Autenticación y sesión

- [ ] Login admin global → redirige a `/` (dashboard interno).
- [ ] Login operador (tenant) → ve solo su organización.
- [ ] Login portal cliente (`/portal/login`) → ve solo sus embarques.
- [ ] Login demo → modo readonly real (no permite mutaciones).
- [ ] Logout limpia sesión en todas las pestañas.
- [ ] Refresh de token funciona pasado 1h sin re-login.
- [ ] Impersonación: super_admin entra como tenant y vuelve sin romper estado.

## B. Clientes

- [ ] Wizard alta cliente: subir CSF → Gemini autocompleta RFC/razón/domicilio.
- [ ] Validación de 11 documentos obligatorios bloquea finalización.
- [ ] Edición de cliente (datos fiscales, contactos, Tax ID internacional).
- [ ] Eliminar cliente: doble confirmación "ELIMINAR" funciona y bloquea si hay embarques.

## C. Cotizaciones

- [ ] Crear cotización con conceptos en MXN y USD (TC dinámico Frankfurter).
- [ ] IVA = tasa activa de `useTasaIVA` (no hardcodeada).
- [ ] Conversión cotización → embarque preserva conceptos y partidas.
- [ ] PDF de proforma se genera con logo y datos correctos.

## D. Embarques

- [ ] Wizard FCL: ruta, contenedores, conceptos, partidas, contactos.
- [ ] Wizard LCL: validaciones de auto-asignación correctas.
- [ ] Edición de embarque sincroniza conceptos (patrón delete/re-insert).
- [ ] Estados ETD/ETA, demoras y alertas en sidebar coinciden con datos reales.
- [ ] Tracking automático (JSONCargo) solo disponible a operador/admin.
- [ ] Documentos de embarque: alerta de incompletos cuenta correctamente.

## E. Liquidación / Finanzas

- [ ] Badges "Pagados / Pendientes" reflejan estado real.
- [ ] Proyección de facturación y huecos correctos.
- [ ] Reportes CRM (forecast, leaderboard) cargan sin exceder caps (5000).
- [ ] Exportación CSV de listado de embarques abre en Excel sin encoding roto.

## F. CRM

- [ ] Captura de lead → conversión a oportunidad → cierre.
- [ ] Pipeline editable, hot-keys funcionan.
- [ ] Next Best Actions sugiere las 5 reglas correctas.

## G. Portal cliente

- [ ] Cliente solo ve embarques de su `cliente_id`.
- [ ] Detalle de embarque sin secciones administrativas.
- [ ] Gráfica de carga apilada renderiza con datos reales.
- [ ] Descarga de documentos respeta RLS de storage.

## H. Configuración y administración

- [ ] Panel admin global: TabSeguridadGlobal, TabPlataforma cargan.
- [ ] Tasas IVA editables y propagan a cotizaciones nuevas.
- [ ] Bitácora muestra actividad y respeta RLS multi-tenant.
- [ ] Auditoría: hallazgos filtrables por regla / severidad / responsable.

## I. Búsqueda y navegación

- [ ] Ctrl+K abre búsqueda global; selección navega correcto.
- [ ] Sidebar muestra org name y badge de rol efectivo.
- [ ] Alertas de demurrage en sidebar coinciden con ETA real.

## J. Seguridad (validaciones manuales)

- [ ] Cliente NO puede ejecutar `jsoncargo-track` (debe dar 403 tras parche).
- [ ] Invitación a portal: redirect solo a orígenes allow-listed.
- [ ] Viewer NO puede ver `auditoria_snapshots`, `bitacora_actividad`, `tracking_intentos` — **PENDIENTE: ajustar RLS antes de GA** (ver §L).
- [ ] Tests de RLS pasan: `bunx vitest run rls`.

## K. Performance smoke

Cargar dataset realista (≥500 embarques, ≥200 cotizaciones, ≥1000 leads) en Test y medir:

| Vista | Métrica objetivo | Real |
|---|---|---|
| `/embarques` lista paginada (50/page) | TTI < 1.5 s | __ |
| `/dashboard` dinámico | TTI < 2 s | __ |
| Ctrl+K búsqueda global | resp. < 500 ms | __ |
| Wizard nuevo embarque (paso 1 → 5) | sin lag | __ |
| Exportación CSV 500 embarques | < 3 s | __ |

Documentar en `docs/rc-perf.md`.

## L. Backlog pre-RC (no bloqueante para -rc.1, sí para GA)

Hallazgos abiertos del último `security--run_security_scan` que deben cerrarse antes de **12.0.0**:

| ID | Categoría | Acción |
|---|---|---|
| `client_error_log_abuse` | Edge function | Validar firma JWT con `getClaims` + rate limit por IP |
| `auditoria_snapshots_viewer_access` | RLS | Restringir SELECT a admin/operador/super_admin |
| `bitacora_actividad_operador_access` | RLS | Scopear `has_role('admin')` por `organization_id` |
| `tracking_intentos_no_role_restriction` | RLS | Restringir SELECT/INSERT a admin/operador/super_admin |

Hallazgos ya corregidos en este ciclo:

- ✅ `invite_origin_redirect` — allow-list de orígenes en `invite-client-user`.
- ✅ `jsoncargo_track_authz` — `checkAdminAccess` añadido en `jsoncargo-track`.

## M. Rollback dry-run

- [ ] Ejecutar procedimiento de `docs/backups-rollback.md` en entorno Test.
- [ ] Confirmar restauración de un backup < 24h en menos de 30 min.
- [ ] Documentar fecha y duración en `docs/rc-perf.md` (sección Rollback).

## N. Criterio de corte RC

Para etiquetar **12.0.0-rc.1**:

1. Secciones A-J todas en PASS o con FAILs aceptados por el dueño del producto.
2. Sección K con todas las métricas dentro del objetivo (o con justificación documentada).
3. Sección M ejecutada y exitosa.
4. Sección L: hallazgos restantes documentados como deuda pre-GA.

Para etiquetar **12.0.0** (GA):

1. Sección L completa (0 hallazgos abiertos sin justificar en `@security-memory`).
2. Ventana de 5-7 días hábiles de testers sin show-stoppers.
3. 770/770 tests verdes en el commit congelado.
