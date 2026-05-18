# Toast de error con panel de detalles copiables

## Objetivo

Convertir los toasts de error en una herramienta de debug real: al hacer click en el toast (o en un botón "Ver detalles") se abre un panel con TODO el contexto técnico del error y un botón "Copiar" para pegarle el reporte completo al administrador o a Lovable.

## Comportamiento UX

- El toast destructive se ve igual que hoy (título + descripción corta).
- Aparece un botón discreto **"Ver detalles"** dentro del toast (ToastAction). El toast completo también es clickeable.
- Al hacer click se abre un `Dialog` global "Detalles del error" con:
  - Reporte formateado en bloque de código mono.
  - Botón **"Copiar reporte"** (copia markdown listo para Slack/Lovable).
  - Botón **"Copiar JSON"** (mismo payload en JSON crudo).
  - Botón "Cerrar".
- El toast NO se cierra solo cuando hay payload de debug (queda hasta que el usuario lo descarte), para no perder el contexto.

## Reporte (qué incluye)

Auto-capturado en cada error:
- App version (`APP_VERSION`)
- Timestamp ISO + zona horaria local
- Ruta actual (`window.location.pathname + search`)
- Usuario: `id`, `email`, organización activa, rol efectivo (vía `useAuth` / contexto existente)
- User agent + viewport
- Título y descripción del toast
- `phase` / `step` (si se pasaron)
- Mensaje del error original, `name`, `code` (Supabase: `code`, `details`, `hint`, `status`)
- Stack trace (si existe)
- Contexto adicional libre (`context: Record<string, unknown>`) que cada call site puede pasar (ej. `embarqueId`, `documentoId`, `fileName`, `bucket`, `path`).

Formato markdown ejemplo:

```text
**Error en Libre Carga**
- Versión: 8.215.0
- Fecha: 2026-05-18 16:42:11 (America/Mexico_City)
- Ruta: /embarques/18d1.../?tab=documentos
- Usuario: valeria@... (id 4f2a...) — org "ACME" — rol operador
- Fase: subida de documentos

**Mensaje**
new row violates row-level security policy

**Detalles técnicos**
code: 42501
status: 403
context: { embarqueId: "18d1...", documentoId: "...", bucket: "documentos", path: "embarques/.../..." }

**Stack**
...
```

## Cambios técnicos

1. **`src/lib/ui/errorReport.ts` (nuevo)**
   - `buildErrorReport(input): ErrorReport` que arma el objeto debug, leyendo `APP_VERSION`, ruta, UA, etc.
   - `formatReportMarkdown(report)` y `formatReportJson(report)`.

2. **`src/lib/ui/appFeedback.ts`**
   - Extender `ErrorNotifyOptions` con:
     - `error?: unknown` (Error | PostgrestError | string)
     - `context?: Record<string, unknown>`
   - `notifyError` construye el reporte y lo adjunta en `toast({..., debug: report})`.

3. **Store global `src/lib/ui/errorDetailsStore.ts` (nuevo)**
   - Pequeño store (`useSyncExternalStore` estilo `use-toast`) con `openReport(report)` / `close()` / `useErrorReport()`. Evita acoplar el dialog al árbol de toasts.

4. **`src/hooks/use-toast.ts`**
   - Aceptar campo opcional `debug?: ErrorReport` en `ToasterToast`.
   - Cuando hay `debug`, no auto-cerrar (`duration: Infinity`) y exponerlo al `Toaster`.

5. **`src/components/ui/toaster.tsx`**
   - Si `debug` existe:
     - Render `<ToastAction onClick={() => openReport(debug)}>Ver detalles</ToastAction>`.
     - Hacer el `Toast` clickeable (onClick en el root) que también abre el reporte.

6. **`src/components/ui/ErrorDetailsDialog.tsx` (nuevo)**
   - Suscrito a `useErrorReport()`.
   - Render `<Dialog>` con `<pre>` del markdown, botones "Copiar reporte" / "Copiar JSON" usando `navigator.clipboard.writeText` + `toast.success("Copiado")`.
   - Montar una sola vez en `src/App.tsx` (junto al `<Toaster />`).

7. **Call sites priorizados** (los demás siguen funcionando, sólo no incluirán `error`/`context` hasta que se actualicen)
   - Subida de documentos del embarque (donde Valeria vio el error de RLS): pasar `error`, `phase: "subida de documentos"`, `context: { embarqueId, documentoId, bucket, path, fileName, fileSize }`.
   - Cualquier hook que ya use `notifyError` queda compatible (campos nuevos son opcionales).

8. **Changelog + versión**
   - Bump a **8.216.0**.
   - Entrada en `src/content/changelog/v8/chunks/0.ts` + `changelogData.ts` + `src/pages/Changelog.tsx`.

## Fuera de alcance

- No se cambia el estilo visual de los toasts existentes.
- No se migra masivamente todos los `notifyError` a pasar `error`/`context`: sólo el de subida de documentos en esta iteración. El resto se irá enriqueciendo en próximas mejoras.
- No se envían reportes automáticamente a un backend; sólo copy/paste manual.

¿Procedo con esta implementación?
