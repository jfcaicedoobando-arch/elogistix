# Plan: Mejorar `security-memory`

El documento actual (implícito) trata al proyecto como "prototype con datos públicos", pero **Libre Carga es una plataforma multi-tenant en producción** con datos fiscales reales (RFC, CFDI, facturas, embarques, cobranza). Ese desalineamiento hace que el scanner y futuros agentes minimicen hallazgos que sí importan (p. ej. exposición cross-org). Voy a reescribirlo para reflejar la postura real.

## Contenido propuesto (via `security--update_memory`)

Secciones:

1. **App & modelo de acceso**
   - SaaS multi-tenant para forwarders. Aislamiento por `organization_id` vía `organization_members` + RLS.
   - Roles en tabla separada `user_roles` (+ `has_role` SECURITY DEFINER). Roles: `super_admin`, `admin`, `admin_org`, más roles funcionales; jamás guardar rol en `profiles`.
   - Portales: interno (staff forwarder), cliente (`client_users`), agente (`agente_users`).
   - Datos sensibles reales: RFC, CFDI/XML, facturas, pagos, BBVA movimientos, contactos.

2. **Lo que nunca debe pasar**
   - Lectura o escritura cross-org de: `clientes`, `embarques`, `facturas`, `pagos_factura`, `proformas`, `cotizaciones`, `proveedores`, `cobranza_seguimiento`, `bbva_movimientos`, `crm_*`.
   - Un usuario del portal cliente/agente viendo datos de otro cliente/agente.
   - Escalada de privilegios vía `user_roles` desde el cliente (sólo service_role / admin escribe).
   - Credenciales FacturAPI (`facturapi_credenciales`) legibles por no-admins de la org.
   - Edge functions sin `authenticate()` + `authorizeOrgMembership()` cuando tocan datos de una org.
   - `CREATE TABLE public.*` sin `GRANT` explícito + RLS + policies en la misma migración.
   - RLS con `USING (true)` en tablas de datos (sólo permitido en catálogos globales).
   - Uso directo de `window.localStorage` fuera de `src/lib/browserStorage` o del cliente autogenerado.
   - Exponer `service_role` o password de DB al frontend / edge responses.

3. **Riesgos aceptados / intencionales (no crear vulnerabilidad para)**
   - `navieras`, `puertos`, `planes`, `tipos_contenedor`: lectura pública a `authenticated` — catálogos compartidos sin precios ni datos por tenant.
   - Bucket `facturas-pdf`: `SELECT` scoped por `organization_members`; INSERT/UPDATE/DELETE se hacen exclusivamente desde edge functions con `service_role` (no requieren policies de escritura para usuarios).
   - Tablas `_backup_*_2026*`: RLS enabled, sin policies → fail-closed. Se mantienen como respaldo temporal post-migración; pendiente drop cuando se cierre la ventana de rollback (ver `docs/backups-rollback.md`).
   - Anon key de Supabase publicada en repo/`.env` (rol `anon`, protegido por RLS) — allowlisted en `.gitleaks.toml`.
   - Landing y `demo_leads` capturan datos con RLS que permite `INSERT` anónimo (funnel público de marketing).

4. **Guardarraíles ya vigentes** (para que scanners no los re-flaggeen)
   - `has_role(_user_id, _role)` SECURITY DEFINER usada en policies para evitar recursión.
   - Edge functions comparten `_shared/auth.ts` (`authenticate`, `authorizeOrgMembership`, `checkAdminAccess`).
   - Tests de arquitectura en `src/__tests__/architecture/*` bloquean regresiones (no-raw-table, sentry-edge-wrapping, safe-casts, mutations-have-onerror, etc.).
   - E2E `06-security-cross-org.spec.ts` valida aislamiento entre tenants.
   - Índice único parcial `embarques_expediente_org_unico` evita colisión de folios.

## Entregable

Una sola llamada a `security--update_memory` con el markdown anterior. Sin cambios de código.

## Preguntas

Ninguna — si prefieres tono más corto o quieres omitir la sección de "riesgos aceptados", dímelo y lo ajusto antes de escribir.
