## Objetivo
En el ErrorBoundary global (`src/components/shared/ErrorBoundary.tsx`):
1. Eliminar el fallback de `mailto:` — "Reportar" siempre debe ir a Sentry.
2. Mostrar información suficiente para depurar cuando la UI se rompe.

## Cambios en `ErrorBoundary.tsx`

### 1. Botón "Reportar" → siempre Sentry
Nueva cadena de intentos, sin `mailto`:
1. `Sentry.getFeedback()?.createForm()` (widget con formulario, prellenado con `associatedEventId = eventId`).
2. Si no hay widget disponible: `Sentry.showReportDialog({ eventId })`.
3. Si tampoco hay `eventId` (caso raro): capturar un `Sentry.captureMessage("Manual crash report – sin eventId")` con el `error.message` como contexto, luego reintentar el widget con el nuevo id.
4. Toast informativo ("Reporte enviado a soporte") vía `notifySuccess` para confirmar al usuario.

Si el widget/dialog falla, mostrar toast de error con el `eventId` para que el usuario lo comparta manualmente — nunca abrir cliente de correo.

### 2. Panel de detalle ampliado
Reemplazar el `<pre>` actual (sólo `error.message`) por un bloque colapsable con:
- **Mensaje** (`error.message`)
- **Nombre** (`error.name`)
- **Ruta** (`window.location.pathname + search`)
- **Timestamp ISO** (capturado en `componentDidCatch`)
- **Event ID de Sentry**
- **Versión de la app** (`APP_VERSION` desde `@/lib/version`)
- **Stack** (`error.stack`, truncado con scroll)
- **Component stack** (guardado del `errorInfo.componentStack`)

Añadir botón "Copiar detalles" que copia todo el bloque a portapapeles como texto plano (útil para pegar en Slack/tickets). Usa `navigator.clipboard.writeText` + toast.

Layout: usar `<details>`/`<summary>` (o `Collapsible` de shadcn si ya está en uso) para no saturar la tarjeta; abierto por defecto en dev, cerrado en prod (`import.meta.env.DEV`).

### 3. Guardar `componentStack` en state
Extender `State` con `componentStack: string | null` y `timestamp: string | null` (poblados en `componentDidCatch`) para poder renderizarlos.

## Fuera de alcance
- No tocamos `FeedbackButton.tsx` (widget flotante, ya usa Sentry).
- No cambiamos `feedbackConfig.ts` ni la init de Sentry.
- No tocamos el edge function `logClientError` — se sigue llamando igual.

## Detalles técnicos
- Tests: actualizar/añadir test en `src/components/shared/__tests__/` (si existe) para verificar que ya no se asigna `window.location.href = "mailto:..."` y que se llama `Sentry.getFeedback` / `Sentry.showReportDialog`.
- Bump `APP_VERSION` a `13.299.22` y agregar entrada en `CHANGELOG.md`.
- Mantener las reglas Power of 10: archivo sigue ≤200 líneas; si crece, extraer el panel de detalle a `ErrorDetailsPanel.tsx`.
