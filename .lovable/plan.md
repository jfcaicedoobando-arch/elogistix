## Reemplazo total del módulo de feedback por Sentry User Feedback

Sentry tiene un widget oficial (`@sentry/react` con la integración `feedbackIntegration`) que cubre por defecto lo que nos tomó 6 versiones armar:

- Botón flotante o disparable por código.
- Modal pulido, animado, accesible, dark-mode aware, traducible.
- Screenshot del viewport con anotaciones (cajas, flechas, blur) — incluido en la integración `feedbackScreenshotIntegration` desde SDK v8.
- Adjunta automáticamente: stack trace si hay error reciente, breadcrumbs (clicks, nav, fetch, console, XHR), release/version, OS, navegador, viewport, replay opcional.
- Tags arbitrarios: `organization_id`, `effective_role`, `email`.
- Panel admin: Issues + Feedback dentro de sentry.io, con asignación, estados, comentarios, integraciones con Slack/Linear.

Vamos a quitar todo el módulo casero y dejar Sentry como única vía.

## 1. Setup de Sentry (lado usuario)

Necesitas:

1. Cuenta en **sentry.io** (free tier: 5K errores + 50 feedback/mes — suficiente).
2. Crear un proyecto tipo **React**.
3. Copiar el **DSN** (formato `https://xxx@oXXX.ingest.sentry.io/XXX`). Es un valor público, pensado para ir en el bundle del frontend.

Cuando confirmes que ya tienes el DSN, lo agrego como `VITE_SENTRY_DSN` con la herramienta de secrets.

## 2. Instalación y arranque

- `bun add @sentry/react`.
- Nuevo `src/lib/sentry.ts` que llama a `Sentry.init`:

```ts
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: APP_VERSION,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.feedbackIntegration({
      colorScheme: "light",
      showBranding: false,
      autoInject: false, // controlamos nosotros el botón
      triggerLabel: "Reportar bug o sugerencia",
      formTitle: "Reportar bug o sugerencia",
      submitButtonLabel: "Enviar reporte",
      messagePlaceholder: "Cuéntanos qué pasó. Incluye pasos para reproducirlo.",
      successMessageText: "Gracias, recibimos tu reporte.",
      // Integración separada de screenshot+anotaciones
    }),
    Sentry.feedbackScreenshotIntegration(),
  ],
  tracesSampleRate: 0.1,
});
```

- Invocar `init` en `src/main.tsx` **antes** del `createRoot`.

## 3. Identificar al usuario y al tenant

En `AuthContext` (o donde ya tengamos el usuario resuelto), después del login:

```ts
Sentry.setUser({ id: user.id, email: user.email });
Sentry.setTags({
  organization_id: organizationId ?? "none",
  effective_role: effectiveRole ?? "none",
});
```

Y `Sentry.setUser(null)` al logout. Esto hace que cada reporte llegue ya etiquetado por organización y rol — lo que cubre la parte de "multi-tenant" que perdimos al salir de nuestra DB.

## 4. Botón disparador

`FeedbackButton.tsx` se reduce a ~15 líneas: trae la instancia del widget y dispara `openForm()` en el click.

```tsx
const feedback = Sentry.getFeedback();
const onClick = async () => {
  const form = await feedback?.createForm();
  form?.appendToDom();
  form?.open();
};
```

Conservamos el lugar y el ícono actuales en `Layout.tsx`, sólo cambia el handler.

## 5. Borrado del módulo casero

**Archivos a eliminar:**

```text
src/components/feedback/FeedbackDialog.tsx
src/components/feedback/FeedbackForm.tsx
src/components/feedback/FeedbackImageUploader.tsx
src/components/feedback/FeedbackMisReportes.tsx
src/components/feedback/ValidationAlert.tsx
src/hooks/feedback/useElementPicker.ts
src/hooks/admin/useReportesFeedback.ts
src/lib/feedback/breadcrumbsBuffer.ts
src/lib/feedback/consoleBuffer.ts
src/lib/feedback/elementSelector.ts
src/lib/feedback/screenshot.ts
src/services/feedback/index.ts
src/types/feedback.ts
src/pages/admin/AdminReportes.tsx
src/pages/admin/AdminReporteDetalle.tsx
```

**Dependencias a quitar** (`bun remove`):
- `@medv/finder`
- `modern-screenshot`

**Limpieza en código existente:**
- `src/main.tsx`: borrar imports de `installConsoleBuffer` e `installBreadcrumbsBuffer`. Reemplazar por `import "./lib/sentry"`.
- `src/components/feedback/FeedbackButton.tsx`: rewrite a la versión mínima del paso 4.
- `src/App.tsx`: quitar el `lazy` y el `<Route path="/admin/reportes" ...>`.
- `src/components/layout/AppSidebar.tsx` o equivalente: quitar el ítem de menú "Reportes" del admin si existe.
- `src/index.css`: quitar las reglas `.feedback-picker-active`, `#feedback-picker-overlay`, etc.

## 6. Migración DB y storage

Migración SQL:

```sql
drop table if exists public.reportes_feedback_comentarios cascade;
drop table if exists public.reportes_feedback cascade;
drop type  if exists public.tipo_reporte_feedback;
drop type  if exists public.estado_reporte_feedback;
-- limpiar bucket (vacío hoy):
delete from storage.buckets where id = 'reportes-feedback';
```

Como `src/integrations/supabase/types.ts` se regenera, no requiere edición manual; sólo hay que asegurar que ningún archivo siga importando los tipos eliminados (cubierto por borrar `types/feedback.ts` y los servicios).

## 7. Versionado y changelog

- `src/constants/appVersion.ts` → **`9.0.0`** (major, porque eliminamos el módulo entero y rompemos la ruta `/admin/reportes`).
- Entrada en `src/content/changelog/v9/chunks/0.ts` (crear el chunk si no existe) describiendo el reemplazo y dónde ver ahora los reportes (sentry.io).

## 8. Verificación

1. Build pasa sin referencias colgantes a tipos/archivos borrados.
2. Click en el botón "Reportar bug o sugerencia" abre el modal de Sentry con campos Nombre/Email prellenados (gracias a `setUser`).
3. Click en "Add a screenshot" permite recortar y anotar con cajas/flechas/blur.
4. Enviar el reporte → aparece en sentry.io > Feedback con tags `organization_id` y `effective_role`, breadcrumbs, viewport y release `9.0.0`.
5. Forzar un error de JS desde la consola → aparece como Issue en Sentry, ligado al feedback si se reporta en el mismo session.
6. `/admin/reportes` ya no existe (404 esperado).

## Riesgos y mitigaciones

- **Bundle**: `@sentry/react` con Feedback + Screenshot pesa ~85 KB gzipped. Aceptable; eliminamos `@medv/finder` (~3 KB) y `modern-screenshot` (~30 KB) que ya no necesitamos.
- **Tabla `reportes_feedback`**: hoy está vacía o casi (datos de prueba), por eso un `drop cascade` es seguro. Si quieres conservarlos como respaldo, exportamos a CSV antes con un `psql \copy`. Avísame si lo quieres.
- **Conversaciones admin↔usuario**: en Sentry se hacen vía email automático cuando respondes el feedback, no en la app. Si más adelante quieres conversación dentro de tu app, se puede webhook después.

## Archivos creados / modificados / eliminados

**Nuevos:** `src/lib/sentry.ts`, `src/content/changelog/v9/chunks/0.ts` (si aplica).

**Modificados:** `src/main.tsx`, `src/components/feedback/FeedbackButton.tsx`, `src/App.tsx`, `src/contexts/AuthContext.tsx` (setUser/setTags), `src/index.css`, `src/constants/appVersion.ts`, `package.json`, eventual sidebar admin.

**Eliminados:** todo lo listado en §5 + migración SQL del §6.
