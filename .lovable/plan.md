## Revisión Fase P.3 (v13.301.89)

Auditoría rápida de lo generado:

- Migración `20260719044443_..._v13_301_89_fase_p3.sql`: RPC `materializar_factura_retencion_garantia` SECURITY DEFINER con `search_path=public`, gate de rol correcto (`admin/admin_org/operador/super_admin`), valida `retenido`, no re-materialización, naviera mapeada a proveedor por nombre en org, categoría COGS con fallback, folio interno vía `siguiente_folio_proveedor`, `REVOKE PUBLIC/anon` + `GRANT` restringido. Trigger `trg_garantia_auto_materializar` con `EXCEPTION WHEN OTHERS` best-effort que no bloquea la transición de estado. ✅
- Columna `navieras.name` confirmada en la BD → `SELECT name INTO ...` es válido. ✅
- Cliente: `vincularFacturaAConceptos` limpio (ya no marca `estado_liquidacion` desde cliente; delega al trigger `tg_pfc_recalc_liq`). Tests actualizados verifican que no hay `update` a `conceptos_costo`. ✅
- Guardrail `garantias-fase-p3.test.ts` con 9 asserts cubre SECURITY DEFINER + search_path, roles, los 5 códigos de error clave, mapeo por nombre, categoría de presupuesto, inserción en `proveedor_facturas` con folio interno + vínculo, trigger AFTER UPDATE OF estado con manejo de excepción, y `REVOKE/GRANT`. ✅
- CHANGELOG.md y APP_VERSION → `13.301.89`. ✅

**Sin bugs abiertos.** Falta cubrir un test unitario del servicio cliente para el nuevo contrato `{ insertadas }` (ya cubierto en `conceptosCostoVinculables.test.ts`).

Bugs 19–23 de la Ronda 4 quedan cerrados con Fases L–P. Bug 24 fue refutado. Cierra Ronda 4.

---

## Fase siguiente — Auditoría Ronda 5: **Portal cliente, portal agente y notificaciones/emails**

Áreas todavía sin pasar por auditoría profunda. Foco:

1. **Portal cliente** (`/portal/*`): RPCs `SECURITY DEFINER` de sólo lectura, exposición de datos entre orgs, filtros por `client_users`, RLS en documentos descargables, tokens de tracking externo.
2. **Portal agente de carga** (`/agente/*`): aislamiento `agente_users`, permisos de subir/editar documentos, visibilidad de márgenes de venta (no debería ver).
3. **Notificaciones y emails**: `notificaciones_cliente`, `notificaciones_internas`, `email_send_log`/`email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`. Verificar que no se filtren PII entre orgs, que unsubscribe tokens sean single-use, que `factura_recordatorios` respete `estado_vivo` de facturas (post-Fase 62), que edge functions de envío usen `wrapEdgeHandler` + `authenticateRequest` + rate-limit.
4. **Tracking externo** (`tracking_externo`, `tracking_intentos`, `tracking_links`, `tracking_webhook_log`): tokens de acceso público, expiración, webhooks firmados.

### Producto de esta auditoría (sin fixes todavía)

Un reporte con bugs numerados (Bug 26, 27, …), severidad (crítico/alto/medio/bajo), archivo/RPC involucrado, y evidencia (query SQL o fragmento de código). Luego el usuario aprueba las Fases Q/R/… de remediación como en rondas anteriores.

### Fuera de alcance de este turno

- Escribir código o migraciones. Sólo lectura + reporte.
- Rediseño de UI de portal.
- Cambios en CRM (queda para Ronda 6 si aplica).

### Detalles técnicos

- Se revisarán todas las policies de las 12 tablas listadas arriba (via `information_schema` + `pg_policies`).
- Se ejecutará `rg` sobre `src/features/portal-*`, `src/routes/portalRoutes.tsx`, `src/routes/agenteRoutes.tsx`, y `supabase/functions/{send-*,tracking-*,email-*}`.
- Se cruzará con `mem://features/client-portal`, `mem://features/multi-tenant-architecture` y `mem://features/agente-portal` (si existe).
- No se ejecutan cambios; sólo lectura.
