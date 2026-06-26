## Estado actual (qué ya está cubierto)

**Frontend** (`src/lib/observability/sentry/`):
- Init dinámico, PII scrub, env detection, sampling por ruta, replay-on-error.
- `QueryCache.onError` + `MutationCache.onError` reportan automáticamente **todo** error de React Query con tags `feature:react_query`, `kind`, `query_root`/`mutation_root`.
- `reportCaughtError(err, {feature, op})` para try/catch manuales.
- `ErrorBoundary`, telemetría de sesión/perfil, widget de feedback, contexto de usuario.
- Tunnel `sentry-tunnel` para esquivar ad-blockers.

**Edge functions** (18 envueltas con `wrapEdgeHandler`, 8 con captura manual). Tests de arquitectura `sentry-edge-coverage` y `sentry-edge-wrapping` ya obligan a que **toda** función nueva con `index.ts` esté listada o exenta.

## Gaps detectados en código nuevo

1. **Tags genéricos en mutations fiscales**. Las nuevas mutations (`emitirRep`, `cancelarRep`, `timbrarNotaCreditoFacturapi`, `convertirProformasAFactura`, `descargarCfdiFacturapi`, `enviarCfdiEmail`, `crearFacturaManual`, `duplicarFacturaParaSustitucion`) llegan a Sentry sólo con `mutation_root` plano. Sin un `mutationKey` consistente, los issues quedan agrupados como "react_query" sin distinguir flujo.
2. **Fire-and-forget en UI fiscal**. Botones de "Descargar PDF/XML", "Enviar por email", "Copiar webhook URL" hacen `try/catch + toast.error` sin pasar por React Query → si fallan, Sentry no los ve. (Verificado en `descargarCfdiFacturapi.ts` y `FacturapiWebhookUrlSection.tsx`.)
3. **Sin breadcrumbs de dominio** en el flujo Proforma → Factura → Timbrado → Pago → REP. Cuando algo falla, falta el rastro de pasos previos del usuario.
4. **Sin test que prohíba** que un nuevo servicio fiscal trague el error con un `catch { toast.error(...) }` sin reportar.
5. **Verificación end-to-end pendiente**: confirmar que `sentry-tunnel` sigue recibiendo POSTs y que el DSN del front llega.

## Plan

### Fase 1 — Verificación de lo existente
- Correr `bun run test -- sentry` (cubre `core.test`, `helpers.test`, `dropPredicate`, `piiScrub.fase5`, `user.test`, `reportCaughtError.test`, `queryClient.sentry.test`, `useAuthSession.sentry.test`).
- Correr los 3 tests de arquitectura: `sentry-edge-coverage`, `sentry-edge-wrapping`, `sentry-imports-guardrail`.
- Correr `deno test supabase/functions/_shared/sentry_test.ts`.
- Abrir `/admin/sentry-diagnostico` en preview y disparar un evento de prueba; confirmar que llega a Sentry vía el tunnel.

### Fase 2 — Granularidad de tags
- En cada `useMutation` del flujo fiscal nuevo, asignar `mutationKey` jerárquica:
  ```text
  ["fiscal","emitir-factura"]
  ["fiscal","emitir-rep"]
  ["fiscal","cancelar-factura"]
  ["fiscal","cancelar-rep"]
  ["fiscal","nota-credito","emitir"]
  ["fiscal","nota-credito","cancelar"]
  ["fiscal","proforma-a-factura"]
  ["fiscal","sustituir-factura"]
  ["fiscal","descargar-cfdi"]
  ["fiscal","enviar-cfdi-email"]
  ["fiscal","factura-manual"]
  ```
  Esto hace que `mutation_root="fiscal"` agrupe y un tag secundario distinga el paso.

### Fase 3 — Cerrar fugas fire-and-forget
- Auditar handlers que hacen `try/catch + notifyError` sin re-throw ni mutation:
  - `descargarCfdiFacturapi` callers (botón descarga).
  - `enviarCfdiEmail` callers.
  - `FacturapiWebhookUrlSection` (copiar URL).
  - `ConvertirAFacturaDialog`, `DialogSustituirFactura` (botones secundarios).
- Añadir `reportCaughtError(err, { feature: "facturacion", op: "<nombre>" })` en cada `catch`.

### Fase 4 — Breadcrumbs de dominio
Crear `src/lib/observability/fiscalBreadcrumbs.ts` con helper:
```text
addFiscalBreadcrumb(op, data) → Sentry.addBreadcrumb({category:"fiscal", ...})
```
Insertar en los puntos de entrada del flujo (abrir modal, confirmar, recibir respuesta de Facturapi). Lazy import para no inflar bundle.

### Fase 5 — Guardrail arquitectónico
Añadir `src/__tests__/architecture/sentry-fiscal-services.test.ts`:
- Para cada archivo en `src/features/facturacion/services/*.ts` (excepto índices y tipos): si contiene `catch (`, debe **o** re-lanzar el error **o** llamar `reportCaughtError` / `Sentry.captureException`.
- Excluye tests y archivos que el linter ya marca con `// SAFE-CAST:` apropiado.

### Fase 6 — Documentación
- Actualizar `CHANGELOG.md` con entrada del bump.
- Bump `APP_VERSION` a `13.137.15`.
- Anotar en `mem://technical/architecture-and-standards` que las mutations fiscales usan `mutationKey` jerárquica empezando con `"fiscal"`.

## Detalles técnicos

- Los breadcrumbs son síncronos pero el SDK ya está cargado cuando un usuario llega al flujo fiscal (post-login). No requieren dynamic import adicional.
- `reportCaughtError` ya hace dynamic import del SDK, así que añadirlo en handlers no afecta bundle inicial.
- El nuevo test de arquitectura usa lectura de archivos en disco (mismo patrón que los 3 existentes) — sin dependencia runtime.
- No se tocan los wrappers `_shared/sentry.ts` ni `core.ts`. Los cambios son aditivos.

## Fuera de alcance

- No subir `tracesSampleRate` ni `replaysSessionSampleRate` (costo).
- No agregar Sentry a `sentry-tunnel` (sería recursión).
- No instrumentar funciones marketing/landing (sample 0% por diseño).
- No tocar el flujo de demoras automáticas / garantías (no es código fiscal y ya está cubierto vía React Query).
