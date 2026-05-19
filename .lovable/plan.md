
# Sistema de Reportes de Bugs y Mejoras

## Resumen

Botón en el header (junto a búsqueda global) disponible para todos los usuarios autenticados, abre un modal para reportar bugs o mejoras con picker visual de elementos, hasta 3 imágenes y captura automática de contexto técnico. Módulo nuevo en `/admin/reportes` para que el super admin gestione el ciclo de vida: filtros, estados, comentarios y notificaciones al reportero.

---

## 1. Base de datos (migración)

### Tablas nuevas

**`reportes_feedback`** — reporte principal
- `id uuid pk`
- `tipo` enum `tipo_reporte_feedback` ('bug' | 'mejora')
- `estado` enum `estado_reporte_feedback` ('nuevo' | 'en_revision' | 'resuelto' | 'descartado'), default 'nuevo'
- `titulo text not null` (max 200)
- `descripcion text not null` (max 4000)
- `url text` — ruta + query + hash al momento del reporte
- `elemento_selector text` — CSS selector capturado por el picker (opcional)
- `elemento_texto text` — innerText recortado del elemento (opcional)
- `metadata jsonb` — `{ appVersion, userAgent, viewport, dpr, consoleLogs[], timezone, route }`
- `imagenes text[]` — paths en bucket privado (0–3)
- `usuario_id uuid not null` — auth.users.id (no FK)
- `usuario_email text`
- `organization_id uuid` — null si super_admin sin org
- `rol_reportero text`
- `created_at`, `updated_at timestamptz`

**`reportes_feedback_comentarios`** — hilo de respuestas
- `id`, `reporte_id`, `autor_id`, `autor_email`, `autor_es_admin bool`, `contenido text`, `created_at`

### RLS

- `reportes_feedback`
  - INSERT: cualquier authenticated, con `usuario_id = auth.uid()`.
  - SELECT: el propio reportero (`usuario_id = auth.uid()`) o `has_role(auth.uid(),'super_admin')`.
  - UPDATE: solo super_admin (cambia estado).
  - DELETE: solo super_admin.
- `reportes_feedback_comentarios`
  - SELECT: reportero del reporte padre o super_admin.
  - INSERT: reportero (sobre su reporte) o super_admin (sobre cualquier reporte).
- Soft delete no aplica (lo gestiona el super_admin con 'descartado').

### Storage

Bucket privado **`reportes-feedback`**:
- Path: `{usuario_id}/{reporte_id}/{nn}.{ext}`
- RLS objects:
  - INSERT: authenticated cuando `(storage.foldername(name))[1] = auth.uid()::text`.
  - SELECT: reportero del path o super_admin (usar EXISTS contra `reportes_feedback` por consistencia con la memoria `storage-rls-paths`).
- Tipos permitidos: png/jpg/jpeg/webp, max 5 MB c/u.

### Trigger / notificaciones

- Trigger `AFTER UPDATE OF estado` en `reportes_feedback`: inserta en `notificaciones_cliente` SOLO si el reportero tiene rol cliente, y un mecanismo equivalente para usuarios internos (tabla `notificaciones_usuario` existente si la hay; si no, agregar columna `leida_en` en una vista o usar bitácora). Validar en exploración inicial; fallback: trigger inserta en `bitacora_actividad` + el usuario ve un badge en su botón de feedback con conteo de no leídos vía RPC.

### Tipos generados

Después de la migración, `src/integrations/supabase/types.ts` se regenera automáticamente.

---

## 2. Componente del botón en header

**Archivo nuevo:** `src/components/feedback/FeedbackButton.tsx`
- Icono `MessageSquarePlus` o `Bug` de lucide.
- Tooltip "Reportar bug o sugerir mejora".
- Se inserta en `src/components/layout/Layout.tsx` justo antes de `<GlobalSearch />` (también en `src/components/portal/layout/PortalHeader.tsx` y `src/components/admin/AdminLayout.tsx` para cobertura universal).
- Abre `FeedbackDialog`.

---

## 3. Modal de reporte

**Archivo nuevo:** `src/components/feedback/FeedbackDialog.tsx` (orquestador, ≤200 líneas)

Subcomponentes en `src/components/feedback/`:
- `FeedbackForm.tsx` — form con RHF + zod:
  - `tipo`: RadioGroup Bug | Mejora
  - `titulo`: Input (5–200 chars)
  - `descripcion`: Textarea (10–4000 chars)
  - `elemento`: campo readonly con badge del selector capturado + botón "Seleccionar elemento" y "Limpiar"
  - `imagenes`: dropzone + paste handler
- `FeedbackImageUploader.tsx` — hasta 3, soporta `<input type=file multiple>` y listener `paste` global mientras el modal está abierto; previews con botón eliminar.
- `useElementPicker.ts` (hook) — al activarse:
  - Cierra el modal temporalmente (lo oculta con state, no lo desmonta).
  - Añade overlay transparente con `pointer-events: none`.
  - `mousemove`: highlight el elemento bajo el cursor con outline (usando `elementFromPoint`).
  - `click`: previene default, calcula selector único (id > data-testid > path con nth-child), guarda `innerText.slice(0,200)`, reabre modal.
  - `Escape`: cancela.
  - Cleanup completo en unmount.

**Hook nuevo:** `src/hooks/feedback/useConsoleLogBuffer.ts`
- Patch `console.log/warn/error` en `main.tsx` (montaje único), guarda los últimos 50 mensajes en un ring buffer exportado.
- El modal lee el buffer al enviar.

**Servicio nuevo:** `src/services/feedback/index.ts`
- `crearReporte({...})`: sube imágenes a Storage, inserta en `reportes_feedback`, devuelve registro.
- `listarReportes(filtros)`, `actualizarEstado(id, estado)`, `agregarComentario(...)`, `obtenerReporte(id)`.

**Captura automática al enviar** (reutiliza `buildErrorReport` patterns de `src/lib/ui/errorReport.ts`):
- URL completa (`pathname+search+hash`)
- `APP_VERSION`, `navigator.userAgent`, viewport, dpr, timezone
- Últimos 50 logs de consola del buffer
- Usuario/email/org/rol desde `getAuthSnapshot()`

---

## 4. Módulo super admin

**Ruta nueva:** `/admin/reportes` registrada en `src/App.tsx` dentro de `AdminLayout`.

**Página nueva:** `src/pages/admin/AdminReportes.tsx` (lista, ≤200 líneas)
- `PageHeader` "Reportes de usuarios"
- Filtros: tipo (todos/bug/mejora), estado, organización (Select con `useOrganizaciones`), búsqueda texto, rango de fechas
- `DataTable` con columnas: fecha, tipo (badge), título, usuario, organización, estado (badge), acciones
- Paginación servidor (`.range()`), debounce 300 ms (reutiliza `useDebounce` + patrón de `useListPageState`)
- Click en fila → navega a detalle

**Página nueva:** `src/pages/admin/AdminReporteDetalle.tsx` (`/admin/reportes/:id`)
- Layout 2 columnas: 
  - Izq: título, descripción, imágenes (lightbox), URL clickeable, selector + texto del elemento, metadata técnica colapsable
  - Der: panel de estado (Select para cambiar), info del reportero, timeline de comentarios + textarea para responder
- Cambios de estado y comentarios usan mutations con React Query, invalidan la lista.

**Hooks nuevos:** `src/hooks/admin/useReportesFeedback.ts`, `useReporteFeedbackDetalle.ts`, `useReportesFeedbackMutations.ts`

**Sidebar admin:** agregar item "Reportes" en `src/components/admin/AdminSidebar.tsx` con badge de conteo de estado 'nuevo'.

---

## 5. Notificaciones al reportero

- Hook `useReportesPropiosNoLeidos` que cuenta reportes propios con `updated_at > last_seen` (last_seen en localStorage por usuario).
- El `FeedbackButton` muestra un dot rojo cuando hay novedades.
- Al abrir el modal, una pestaña "Mis reportes" lista los reportes del usuario con su estado actual y comentarios del admin.

---

## 6. Detalles técnicos

- **Validación zod** en `src/lib/validation/mutationSchemas.ts`: `feedbackReportSchema`.
- **Tipos** en `src/types/feedback.ts`: `TipoReporte`, `EstadoReporte`, `ReporteFeedback`, `ComentarioFeedback`.
- **Generación de selector único**: helper `src/lib/feedback/elementSelector.ts` con preferencia `[data-testid]` > `#id` > path acotado con `:nth-of-type`. Cap de longitud 300 chars.
- **Paste de imágenes**: listener `paste` en el contenedor del modal mientras está abierto, lee `clipboardData.items` y filtra `image/*`. Cleanup obligatorio.
- **Power of 10**: todos los componentes ≤200 líneas (dividir agresivamente), sin `any`, manejo de `error` de Supabase en cada call, cleanup en todos los `useEffect`.
- **Bitácora**: cada cambio de estado y comentario del super admin se registra en `bitacora_actividad` vía `useBitacora`.

---

## 7. Changelog

Agregar entrada al inicio de `src/pages/Changelog.tsx` con versión minor (nueva funcionalidad), fecha 19/05/2026, título "Sistema de reportes de bugs y mejoras" y descripción breve.

---

## Estructura de archivos nueva

```text
src/
  components/feedback/
    FeedbackButton.tsx
    FeedbackDialog.tsx
    FeedbackForm.tsx
    FeedbackImageUploader.tsx
    FeedbackMisReportes.tsx
  hooks/feedback/
    useElementPicker.ts
    useConsoleLogBuffer.ts
    useReportesPropios.ts
  hooks/admin/
    useReportesFeedback.ts
    useReporteFeedbackDetalle.ts
    useReportesFeedbackMutations.ts
  lib/feedback/
    elementSelector.ts
  pages/admin/
    AdminReportes.tsx
    AdminReporteDetalle.tsx
  services/feedback/
    index.ts
  types/
    feedback.ts
supabase/migrations/
  <timestamp>_reportes_feedback.sql
```

Listo para implementar al aprobar.
