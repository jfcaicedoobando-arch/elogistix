# Roadmap a producción — Libre Carga ERP

Estado: 8.185.0. **Bloque 1, Bloque 2 y Bloque 3.1 cerrados**: 2.1 Error boundaries ✅, 2.2 zod en mutaciones ✅, 2.3 E2E Playwright ✅, 2.4 N+1 fase 2 ✅, 2.5 VirtualDataTable Bitácora ✅, 3.1 Importación CSV clientes/proveedores ✅. Siguiente: **3.2 CFDI 4.0 XML / 3.4 PDFs / 3.6 Auditoría de cambios sensibles** (según prioridad operativa).


## 1. Lo que YA está implementado

**Arquitectura y calidad (Ola A, 8.138–8.142)**
- Hooks/controllers separados de UI, services por subdominio (`queries/` + `mutations/`), `lib/domain/auditoria.ts` con tests puros, ARCHITECTURE.md §5.1.
- Power of 10 aplicado: componentes ≤200 líneas, sin `any`, paginación server-side, cleanup en effects.
- Tipos centralizados, `useToast` unificado, rotación de chunks del changelog.

**Observabilidad y rendimiento (Ola B, 8.171–8.176)**
- B.1 Tabla `app_logs` + `_shared/logger.ts` (request_id, latencia, user/org, status). RLS multi-tenant. Purga 30 días.
- B.2 `/admin/diagnostico` con filtros + paginación server-side + payload expandible.
- B.4 RPCs `embarques_listado`, `facturas_listado`, `reportes_resumen` (elimina N+1).
- B.5 `VirtualDataTable` (@tanstack/react-virtual) aplicado en diagnóstico.
- B.6 `test_rls_isolation.sql` con 8 escenarios multi-tenant.
- C.1 Las 9 edge functions restantes instrumentadas con `createLogger` + `logger.finish()`.

## 2. Lo que falta — priorizado para uso productivo

### Bloque 1 — Estabilidad operativa (CRÍTICO, antes de go-live)

**1.1 Dashboard de salud `/admin/diagnostico`** (Ola C.2, ~2h)
KPIs sobre `app_logs`: errores última hora/24h, p95 latencia por función, top 5 funciones con más fallos, timeline. Ya tienes los datos gracias a C.1; sin esto el log es ruido.

**1.2 Alertas por error sostenido** (B.3, ~2h + setup)
Edge function cron cada 5 min sobre `app_logs`: si N errores/min de la misma función → notificación. **Recomiendo empezar por canal interno (tabla `alertas_sistema` + badge en sidebar para super_admin)** en lugar de Resend, así evitas configurar dominio email ahora. Email queda como fase 2.

**1.3 Backups verificados y plan de restauración** (~1h documentación)
Lovable Cloud hace snapshots automáticos, pero hay que documentar: cadencia, retención, procedimiento de restore, responsable. Sin esto no se puede operar en producción.

**1.4 Hardening de auth**
- Activar **Leaked Password Protection** (HIBP) — switch en Cloud → Users.
- Política de contraseña mínima.
- Revisar timeouts de sesión.
- Confirmar que demo readonly no puede escalar.

**1.5 Correr `supabase--linter`** y resolver hallazgos críticos antes de go-live.

### Bloque 2 — Continuidad y confianza (importante, primeras 2 semanas)

**2.1 Manejo de errores en UI** (~3h)
Error boundaries por ruta principal con fallback amigable + reporte automático a `app_logs` desde frontend (extender logger para client). Hoy un crash deja pantalla en blanco.

**2.2 Validación masiva con zod en mutaciones** (~4h)
Auditar formularios de embarques/facturas/clientes: que TODOS pasen por zodResolver. Hay rincones donde aún se confía en validación HTML.

**2.3 Tests E2E críticos** (~6h)
Playwright para 5 flujos: login, crear embarque, generar factura, conciliación, portal cliente. Hoy tienes 319 unit tests pero cero E2E.

**2.4 N+1 fase 2** (Ola C.3, ~3h)
RPCs `cotizaciones_listado`, `clientes_listado`, `proveedores_listado` con el patrón de B.4.

**2.5 Aplicar `VirtualDataTable` a Bitácora y embarques largos** (~1h)

### Bloque 3 — Completitud funcional (semanas 3-4, según uso real)

Aquí el orden depende de qué huecos detectes en operación. Candidatos típicos en un forwarder:

**3.1 Importación masiva** — CSV de clientes, proveedores, tarifas. Lo más pedido cuando arranca operación real.

**3.2 Exportación contable** — XML CFDI 4.0 / layout para el contador (factura, complemento de pago).

**3.3 Notificaciones a cliente** — al crear/actualizar embarque, vía portal + email opcional.

**3.4 Reportes PDF** — estados de cuenta, conciliación, rentabilidad mensual por cliente.

**3.5 Roles más granulares** — separar "operaciones" de "facturación" si hoy todos son admin.

**3.6 Auditoría de cambios sensibles** — quién editó costos/precios/contactos (la bitácora actual cubre login y CRUD básico, no diff de campos).

## 3. Orden recomendado

```
Semana 1 (go-live):
  Día 1-2:  1.1 Dashboard salud  +  1.5 Linter
  Día 3:    1.4 Hardening auth
  Día 4:    1.2 Alertas internas
  Día 5:    1.3 Documentar backups + plan rollback

Semana 2 (estabilización):
  2.1 Error boundaries
  2.2 Auditar validaciones zod
  2.4 N+1 fase 2

Semana 3 (confianza):
  2.3 Tests E2E críticos
  2.5 VirtualDataTable extendido

Semana 4+ (según operación):
  Bloque 3 priorizado por feedback real de usuarios
```

## 4. Detalles técnicos

- **Dashboard salud**: nuevo componente `DiagnosticoHealthPanel.tsx`, RPC `app_logs_health_summary(p_hours int)` que devuelve `{function_name, total, errors, p95_ms, last_error_at}`. Recharts para timeline.
- **Alertas internas**: tabla `alertas_sistema(id, severity, source, message, created_at, acknowledged_at, acknowledged_by)` + RLS super_admin/admin. Cron `pg_cron` cada 5 min ejecuta función SQL que inserta alertas. Badge en sidebar.
- **Error boundary**: wrapper en `App.tsx` y por ruta lazy. Reporta a edge function `client-error-log` que escribe en `app_logs` con `source='client'`.
- **E2E**: Playwright config con seed determinístico contra ambiente staging.

## 5. Lo que NO recomiendo hacer ahora

- Mover `use-mobile.tsx` (rompe sidebar shadcn vendored — esperar refactor).
- CI job para `test_rls_isolation.sql` (correr manual mensualmente es suficiente).
- Email Resend (canal interno cubre 90% del valor; Resend cuando haya dominio verificado y caso de uso externo).
- Migrar a otro stack o reescribir módulos que ya funcionan.

¿Arranco con **1.1 Dashboard de salud** como primer paso del bloque crítico, o prefieres que ataque **1.5 Linter + 1.4 Hardening auth** primero para descubrir riesgos antes de invertir en el dashboard?
