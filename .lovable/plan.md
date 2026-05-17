# Roadmap producción — Libre Carga (post 8.190.0)

## Estado actual

El ERP **ya cubre el flujo end-to-end**: cotización → embarque (FCL/LCL, tracking automático JSONCargo, documentos, timeline) → proforma → factura → liquidación → estado de cuenta → portal cliente con notificaciones. Tienes multi-tenant con RLS, bitácora con diff de campos sensibles, dashboard dinámico, reportes y exports.

**Lo que YA está implementado** (no se vuelve a tocar):


| Área                                                                                                                              | Estado |
| --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Arquitectura Power of 10 (componentes ≤200, sin `any`, paginación server-side, cleanup en effects)                                | ✅      |
| Multi-tenant con `organizations`, `organization_members`, `user_roles`, RLS verificada en 8 escenarios                            | ✅      |
| Observabilidad: `app_logs`, `/admin/diagnostico`, dashboard de salud, alertas internas, error boundaries con reporte a `app_logs` | ✅      |
| N+1 eliminado: RPCs `*_listado` para embarques, facturas, cotizaciones, clientes, proveedores                                     | ✅      |
| 359 unit tests + 5 specs E2E Playwright (login, embarque, factura, conciliación, portal)                                          | ✅      |
| Importación CSV de clientes y proveedores con validación Zod                                                                      | ✅      |
| PDFs: cotización, proforma, estado de cuenta, rentabilidad                                                                        | ✅      |
| Layout contable CSV para el contador (pre-CFDI)                                                                                   | ✅      |
| Notificaciones al portal del cliente al cambiar estado del embarque                                                               | ✅      |
| Diff de campos sensibles en bitácora (cliente, proveedor, embarque, costos, ventas)                                               | ✅      |
| Tipo de cambio Frankfurter con cache 1h                                                                                           | ✅      |


**Lo que NO está implementado todavía** (insumo de los sprints):

- 71 warnings de `supabase--linter` sin resolver (SECURITY DEFINER expuestos, extensiones en `public`).
- Leaked Password Protection (HIBP) y política de contraseña mínima — no activadas.
- Backups y plan de restauración sin documentar formalmente; sin simulacro de restore.
- CFDI 4.0 XML timbrado (requiere PAC externo — Facturama, SW, FormaPago, etc.).
- Roles granulares (todos los internos son `admin`; falta separar operaciones / facturación / lectura).
- Recordatorios automáticos al cliente (vencimiento factura, ETA próxima, documentos faltantes).
- Conciliación bancaria (subir estado de cuenta del banco y match contra facturas pagadas).
- Reportes ejecutivos: P&L mensual consolidado, aging de cartera, días promedio de cobro.
- Onboarding/entrenamiento: video tour, tooltips contextuales, glosario, página de ayuda interna.
- Métricas de producto: qué pantallas se usan, cuántos embarques crea cada operador, tiempo a primer guardado.
- Backup manual exportable (snapshot zip de toda la org en CSV/JSON) — útil para sandbox del contador.
- App móvil / PWA instalable con shortcut para tracking rápido en bodega.
- Webhooks salientes (notificar a otros sistemas cuando cambia embarque).
- Plantillas guardadas de embarque/cotización (one-click "duplicar template Asia-MX").

---

## Sprints propuestos (2 semanas cada uno, ~40h dev)

### Sprint A — Pre go-live (bloqueante para producción)

Objetivo: dejar la plataforma lista para que entren usuarios reales sin riesgo de fuga de datos ni pérdida.

**A.1 Resolver linter Supabase** — 71 warnings (mayoría `SECURITY DEFINER` con EXECUTE público y extensiones en `public`). Revocar EXECUTE de funciones que no deben ser RPC, mover extensiones fuera de `public`. Riesgo real: hoy un anónimo podría llamar funciones que no debería.

**A.2 Hardening de autenticación**

- Activar HIBP Check (Lovable Cloud → Users → Auth Settings).
- Política contraseña mínima 8 caracteres + 1 número + 1 mayúscula.
- Reducir session timeout a 12h con refresh.
- Verificar que demo readonly no puede escalar (test E2E negativo).

**A.3 Backups y restore** — documento `docs/backups-rollback.md` ya existe pero sin probar. Hacer 1 simulacro real: restaurar snapshot a sandbox, verificar integridad de `embarques` + `facturas`. Documentar tiempo de recuperación (RTO) y datos perdidos máximos (RPO).

**A.4 Página de ayuda interna + onboarding** — `/ayuda` con accordions por módulo + glosario (BL, ETA, demoras, expediente, proforma). Video loom de 5 min embebido. Tooltips contextuales `(?)` en los 10 campos más confusos (modo, incoterm, tipo embarque, BL master vs house).

**A.5 Export manual completo por organización** — botón en `/admin/configuracion` que descarga ZIP con CSV de embarques, facturas, conceptos, clientes, proveedores, bitácora. Seguro contable independiente; el contador puede tener su copia mensual.

---

### Sprint B — Operación real (semanas 3-4)

Objetivo: cubrir los huecos que aparecen cuando un equipo de operaciones usa el ERP 8 horas al día.

**B.1 Recordatorios automáticos cliente**

- Cron diario: factura vencida → notificación portal + email opcional.
- Cron diario: ETA en próximas 48h → notificación portal.
- Cron diario: documentos faltantes a 7 días del ETA → alerta al cliente y al operador.

**B.2 Plantillas de embarque** — botón "Duplicar como plantilla" en embarque. Guarda en `plantillas_embarque(nombre, cliente_id, modo, ruta, conceptos_venta_template, conceptos_costo_template)`. Al crear embarque nuevo: dropdown "Usar plantilla" precarga todo.

**B.3 Roles granulares** (3.5 pendiente) — agregar enum `operaciones` y `facturacion`. Matriz: operaciones CRUD embarques + lectura facturas; facturación CRUD facturas + lectura embarques; admin todo. RLS sobre `conceptos_costo`, `facturas`, `proformas`. Requiere decisión organizacional confirmada antes de tocar RLS.

**B.4 Métricas de uso interno** — tabla `eventos_uso(user_id, evento, props jsonb, created_at)`. Hook `useTrackEvent` en pantallas clave (crear embarque, guardar factura, generar proforma). Panel `/admin/analytics` con: usuarios activos día/semana, embarques creados por operador, tiempo promedio cotización→embarque.

**B.5 Aging de cartera** — vista `aging_cartera` que clasifica facturas pendientes en 0-30 / 31-60 / 61-90 / 90+ días, por cliente y moneda. Reporte PDF mensual descargable. Badge rojo en sidebar si hay facturas >60 días.

---

### Sprint C — Completitud financiera

Objetivo: cerrar el ciclo contable y la conciliación bancaria, que hoy son manuales.

**C.1 CFDI 4.0 timbrado** (3.2 pendiente) — integrar PAC (recomiendo Facturama por API simple). Edge function `timbrar-factura` que recibe `factura_id`, llama al PAC, guarda XML+PDF en bucket y actualiza `facturas.factura_xml_url`. Manejar cancelaciones. Requiere alta como contribuyente + sellos SAT del cliente.

**C.2 Complemento de pago** — al marcar factura como pagada, generar complemento de pago (REP) y timbrarlo. Tabla `complementos_pago` ligada a factura.

**C.3 Conciliación bancaria** — subir estado de cuenta BBVA/Banamex/Santander (CSV o OFX). Algoritmo: match por referencia + monto + fecha tolerancia ±3 días. UI con tres columnas (banco / sin match / facturas pendientes) y drag-and-drop para conciliar manualmente.

**C.4 P&L mensual consolidado** — reporte por mes con: ventas por moneda, costos por moneda, utilidad bruta, margen %, top 5 clientes, top 5 proveedores. Export PDF + Excel.

**C.5 Notas de crédito** — flujo para cancelar parcial o totalmente una factura emitida, con timbrado y actualización de saldo.

---

### Sprint D — Escalamiento y experiencia

Objetivo: que la plataforma escale a más usuarios y se sienta de clase mundial.

**D.1 PWA + shortcut tracking** — manifiesto, service worker, instalable en móvil. Ruta `/m/tracking/:expediente` ultra-ligera para que en bodega escaneen QR del expediente y vean estado en 1 click.

**D.2 Búsqueda global mejorada** — Ctrl+K ya existe, agregar: filtros (embarques cerrados, sólo facturas, sólo clientes), historial reciente, atajos rápidos ("crear embarque", "ir a hueco facturación").

**D.3 Webhooks salientes** — tabla `webhooks_org(url, eventos[], secret)`. Cuando cambia estado embarque o se emite factura, edge function envía POST firmado. Útil para integrar con CRM/ERP del cliente.

**D.4 Notificaciones email transaccionales** (Lovable Email) — extender notificaciones portal a email opcional. Plantillas por evento. Requiere dominio verificado.

**D.5 App logs retention configurable + export** — hoy se purgan a 30 días sin export. Agregar botón "Descargar últimos 90 días" en `/admin/diagnostico` para compliance.

**D.6 Test E2E ampliado** — agregar 10 escenarios más (impersonación, multi-tenant isolation, portal cliente, recordatorios, conciliación). Correr en CI.

---

## Matriz de decisión sugerida

```text
                         Urgencia      Esfuerzo    Dependencia externa
Sprint A (pre go-live)   ALTA          BAJO        Ninguna
Sprint B (operación)     ALTA          MEDIO       Decisión roles
Sprint C (financiero)    MEDIA-ALTA    ALTO        PAC + sellos SAT
Sprint D (escalamiento)  MEDIA         MEDIO       Dominio email (D.4)
```

**Recomendación**: arrancar por **Sprint A completo** (no negociable antes de go-live), luego elegir entre B y C según prioridad del negocio. Si el contador interno ya factura por su lado con el layout actual, B antes que C. Si la presión es cerrar el ciclo contable, C antes que B.

## Detalles técnicos (resumen)

- **A.1**: revisar las 23 funciones `SECURITY DEFINER` con `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated;` selectivo. Mover `pg_trgm` y otras extensiones a schema `extensions`.
- **A.5**: edge function `export-org-snapshot` con auth admin, genera ZIP en memoria, sube a bucket `exports/{org_id}/{timestamp}.zip` con TTL 7 días.
- **B.1**: extender cron `auditoria-snapshot-daily` o crear `notificaciones-cron-diario` que ejecute 3 queries y use el trigger existente.
- **B.4**: `eventos_uso` con índice por `(organization_id, evento, created_at)`, particionable a futuro.
- **C.1**: secret `FACTURAMA_API_KEY`, edge function con retry exponencial. Snapshot factura en `snapshot_emision` ya existe — listo para timbrado.
- **C.3**: parser OFX en `src/lib/banco/parseOFX.ts` (paquete `ofx-data-extractor`), CSV parser ya existe (`parseCsv.ts`).
- **D.3**: secret HMAC por org, retry con backoff, log a `app_logs`.

## Lo que NO recomiendo abordar todavía

- App móvil nativa (PWA cubre 90% del caso).
- Multi-idioma (es-MX es la única región).
- IA generativa para sugerir conceptos (esperar 6 meses de datos reales).
- Integración con SAT directa (el PAC ya lo resuelve).

---

¿Por cuál sprint arrancamos? Mi recomendación es **Sprint A completo**