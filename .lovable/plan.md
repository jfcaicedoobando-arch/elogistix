## Qué revisé (verificado en código y base de datos hoy)

| # | Tema | Estado real |
|---|---|---|
| Q-01 | Solicitud del portal invisible | **PENDIENTE**. El enum `estado_cotizacion` NO tiene `'Solicitada'` (valores: Borrador, Enviada, Aceptada, Rechazada, Vencida, En operación, Archivada) y la policy `Cliente read own cotizaciones` sigue sin incluirla |
| Q-02 | CxP manual sin conceptos | **PENDIENTE**. No existe sección de conceptos manuales en la captura; el toast de lote sigue diciendo "No se pudo aprobar ninguna de las N facturas" (`useAprobarFacturasLote.ts:74`) sin el mensaje del servidor |
| Q-03 | Matching de tarifas | **PENDIENTE**. `get_top_tarifas` no usa `locode` en ninguna parte de su cuerpo (matching por id de fila) |
| Q-04 | SoD tesorero/ventas | **PENDIENTE**. No existe ninguna función en BD que emita `LC_SOD_VIOLATION` |
| Q-05 | Alta de usuarios | **PENDIENTE**. `createUserViaEdgeFunction` castea el rol a `"admin"|"operador"|"viewer"` (bug de mapeo), no re-verifica la membresía tras crear, no valida duplicados, y no envía `orgId` a la edge function |
| Q-06 | Divisas Tesorería | **PARCIAL**. `calcularResumenTesoreria` ya acepta `tipoCambioUsd`, pero cae a `1` si no llega; falta enchufar el TC del DOF y cubrir el flujo proyectado |
| Q-07/08/09/10/11/12/13 | Inputs, banner, retry, concepto libre, RBAC, autosave, navieras | **SIN EVIDENCIA de fix** — requieren verificación dirigida antes de tocar código |
| Q-14 | integrity-guard | **HECHO** (v13.334.5: exclusión de agregados y funciones de extensiones) |
| Q-15/Q-16 | Lotes medio/bajo | **PENDIENTES** salvo lo que coincida con arreglos previos |
| Q-17 | Seed demo E2E | **PENDIENTE**. En `scripts/e2e/` solo hay provisioning de usuarios/tenants, no seed de catálogos |

Tests: no hay suites nuevas asociadas a Q-01…Q-17; sí existen las de rondas previas (CxP, tesorería, proformas). Es decir, **no, no están todos los tests generados**.

## Plan de cierre

### Fase 1 — Bloqueantes de release (Q-01 a Q-05)
- **Q-01**: migración que agrega `'Solicitada'` al enum, actualiza la policy del cliente y el RPC `portal_solicitar_cotizacion`; filtro de estados en `/portal/cotizaciones` y badge "Solicitud de portal" en la bandeja de ventas.
- **Q-02**: sección de conceptos manuales en captura CxP (descripción, cantidad, monto, clave unidad, IVA) con validación de cuadre ±0.01, y propagación del mensaje real del servidor en `useAprobarFacturasLote` (singular/plural, sin navegar).
- **Q-03**: diagnóstico de duplicados en `puertos`/`tipos_contenedor`, matching por `locode`/código en `get_top_tarifas` y en la query de sugeridas, y eliminación del estado contradictorio error+empty-state.
- **Q-04**: verificación de rol dentro de las RPC SECURITY DEFINER de CxP (`LC_SOD_VIOLATION`), guardas de flujo en cotización (Aceptar solo si Enviada y total > 0, sin auto-aceptación) y ocultar acciones no permitidas en UI.
- **Q-05**: `orgId` obligatorio, rol pasado como `app_role` exacto, re-verificación de `organization_members` post-alta (sin toast verde si falla), validación de duplicado en cliente y 409 en la edge function, columna de estado real en la tabla.

### Fase 2 — Altos (Q-06 a Q-11)
Conversión de divisas con TC del DOF en Tesorería y flujo; inputs de importes con un único source of truth; banner global por-ruta con "Reintentar" en vez de navegar; `timeoutMs`/`onRetry` en flujo de tesorería y detalles de factura; concepto libre y CTA inline en costos; matriz rol→ruta única con toast de acceso denegado.

### Fase 3 — Medios/bajos y prevención (Q-12, Q-13, Q-15, Q-16, Q-17)
Autosave completo del wizard, alta de navieras + estabilidad del modal, los 9 puntos del lote medio, los 10 de pulido UX y el script `scripts/e2e/seed-demo.ts`.

### Tests por fase
- Unitarios: RPC de portal (estado creado), cuadre de conceptos CxP, matching de tarifas por locode, guardas SoD, mapeo de rol en alta de usuarios, conversión de divisas en resumen y flujo.
- Componente: no-reset de IVA al teclear retenciones, banner con Reintentar, empty-state con CTA.
- E2E: cliente solicita cotización → la ve → ventas la envía → cliente acepta.

## Detalles técnicos
Cada fase cierra con `bun run lint`, tests y `audit:migrations`; toda migración nueva incluye GRANT/REVOKE explícitos para no reactivar H6. Se registra cada fase en `CHANGELOG.md` con bump de `APP_VERSION`.

Sugerencia: ejecutar la Fase 1 primero y validar en preview antes de seguir.
