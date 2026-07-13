
## Auditoría de la Fase P1 (v13.294.0)

### Lo que quedó bien ✅
- `WizardTotalsBar`: consume el P&L que ya calcula el orquestador, no duplica matemática, tiene semáforo de margen y aria-label. **4/4 tests.**
- `useCotizacionKeyboardShortcuts`: cleanup obligatorio, respeta textareas/contenteditable, deps completas. **7/7 tests.**
- **34/34 tests verdes** para P0 + P1. Typecheck limpio.

### Huecos detectados 🔴

1. **`Ctrl/Cmd + S` no hace nada útil hoy.** El hook `useCotizacionDraftAutosave` sólo expone `clear`, no `flush()`. Y `CotizacionWizardLayout` tampoco pasa `onFlushDraft` al hook de shortcuts. En la práctica el atajo se anuncia pero es un no-op.
2. **Descubribilidad cero.** No hay ninguna pista visual de que existan atajos. Un usuario nuevo nunca los va a encontrar.
3. **`sticky bottom-0` de la barra de totales** vive dentro del `WizardShell > children`, no del footer. Depende del scroll container correcto — hay que verificarlo con Playwright (riesgo bajo pero visible).
4. **Tests de integración del layout faltan.** Probamos los componentes aislados, pero nadie prueba que apretar `Ctrl+Enter` en el paso 2 dispara `handleSiguiente` con el form real.

### Cierre de P1 (parte "auditoría + tests que faltan")

**Fixes:**
- `useCotizacionDraftAutosave` → exponer `flush()` que persiste sincrónicamente (además del debounce). Retorno pasa de `{ clear }` a `{ clear, flush }`.
- `NuevaCotizacion.tsx` → pasar `flush` al layout vía prop (`onFlushDraft`).
- `CotizacionWizardLayout.tsx` → aceptar `onFlushDraft?` y pasarlo al hook de shortcuts + mostrar toast "Borrador guardado" cuando se dispara.
- `CotizacionWizardFooter.tsx` → agregar tooltip discreto en los botones "Siguiente" / "Guardar" mostrando el atajo (`⌘↵`). Solo visual, sin lógica nueva.

**Tests nuevos (~8):**
- `useCotizacionDraftAutosave.test.tsx` → 2 casos para `flush()` (persiste inmediato, no rompe si `enabled=false`).
- `CotizacionWizardLayout.integration.test.tsx` → smoke que verifica que `Ctrl+Enter` en paso 2 llama al `handleSiguiente` del `useCotizacionWizardForm` con RHF real y mocks mínimos de Supabase. **Este test se ha estado extrañando desde P0.**
- Playwright visual (opcional, headless): abrir `/cotizaciones/nueva`, mandar a paso 2, screenshot con la barra sticky visible sobre el footer.

## Fase P2 — Arranque: Templates de cotización

De la hoja de ruta original teníamos dos frentes para P2: **templates** y **unificar "Agregar concepto"**. Recomiendo arrancar por templates (mayor ROI: cotizar en 30s vs 5 min) y dejar la unificación técnica para P2.5.

### P2 — Templates de cotización

**Problema real:** los ejecutivos de ventas cotizan las mismas rutas (Shanghái→Manzanillo 40'HC, Ningbo→Veracruz LCL, etc.) todos los días. Cada cotización repite la misma captura de origen/destino/contenedor/incoterms/conceptos base.

**Solución:**

1. **Guardar como plantilla** — botón nuevo en `CotizacionSuccessDialog` ("Guardar esta cotización como plantilla"). Pide nombre + descripción opcional + visibilidad (Sólo yo / Toda la organización).
2. **Nueva tabla `cotizacion_plantillas`** (organization_id, usuario_id, nombre, descripcion, visibilidad, payload jsonb, veces_usada, ultima_uso_at). RLS + GRANT según regla core. Payload guarda `datosGenerales` + `conceptos base` sin folios/fechas/tarifa (esos se generan al usarla).
3. **Selector "Usar plantilla"** — en paso 1 de `NuevaCotizacion`, `Combobox` arriba del formulario ("Empezar desde plantilla…") con las 20 plantillas más usadas del tenant + filtro por origen/destino. Aplicar plantilla = `form.reset()` + `trigger()` + skip a paso 2 si la ruta ya está.
4. **Administración de plantillas** — página `/cotizaciones/plantillas` (permiso `manage_cotizacion_templates`). Lista con nombre, uso, última fecha, autor. Editar nombre/descripción, cambiar visibilidad, eliminar (soft-delete estándar `deleted_at`).
5. **Métrica de éxito** — incrementar `veces_usada` + `ultima_uso_at` cuando la plantilla se aplica y la cotización se guarda (no cuando se abre nomás).

### Alcance NO incluido en este arranque
- Compartir plantillas entre organizaciones.
- Plantillas "oficiales" pre-cargadas por Libre Carga.
- Sugerencia inteligente ("basado en tu historial, probablemente quieras esta plantilla") — eso es P3.
- Unificar "Agregar concepto" (queda para P2.5).

### Detalles técnicos

- **Migración SQL** (`supabase/migrations/*_cotizacion_plantillas.sql`): tabla + índices `(organization_id, visibilidad, veces_usada DESC)` y `(organization_id, usuario_id)`, `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated`, `GRANT ALL ... TO service_role`, RLS enable, políticas: SELECT vía `has_org_membership + (visibilidad='org' OR usuario_id=auth.uid())`, INSERT sólo autor autenticado en su org, UPDATE/DELETE sólo autor o rol admin/gerente (usar `has_role`).
- **Hooks** (React Query, cumpliendo memoria `queryOptions()` + query keys centralizadas):
  - `cotizacionPlantillasKeys.list(orgId)` en `src/lib/queryKeys.ts`.
  - `useCotizacionPlantillas()` (list, `staleTime: 60_000`).
  - `useGuardarPlantilla()` mutation con optimistic update + toast.
  - `useAplicarPlantilla()` que incrementa contador vía RPC `aplicar_plantilla_cotizacion(id uuid)` para atomicidad.
- **RPC** `aplicar_plantilla_cotizacion` (SECURITY DEFINER, valida tenancy): update `veces_usada = veces_usada + 1, ultima_uso_at = now()` + devuelve payload.
- **Componentes nuevos** (todos ≤200 líneas por Power of 10):
  - `PlantillaSelectorPaso1.tsx` (Combobox arriba del paso 1).
  - `GuardarPlantillaDialog.tsx` (invocado desde `CotizacionSuccessDialog`).
  - `PlantillasList.tsx` + ruta `/cotizaciones/plantillas`.
- **Tests** (mínimo por componente):
  - `useCotizacionPlantillas.test.tsx` — cache, invalidación, error handling.
  - `PlantillaSelectorPaso1.test.tsx` — aplicar plantilla llama a `form.reset` y salta al paso correcto.
  - `GuardarPlantillaDialog.test.tsx` — valida nombre requerido, visibilidad default = "yo", limpia al cerrar.
  - `aplicar_plantilla_cotizacion` — test de Deno edge en `supabase/functions` si aplica; si es RPC puro, cubrir vía integración con `supabase.rpc` mock.

### CHANGELOG y versión

- Cierre de auditoría P1: **v13.294.1** (patch, sólo fixes/tests).
- Arranque de P2 (templates): **v13.295.0** (minor, feature).
- Entrada en `CHANGELOG.md` root para cada uno.

### Riesgos y qué podría romperse

- **Payload de plantilla desactualizado** si el schema de `datosGenerales` cambia en el futuro. Mitigación: versionar el payload (`{ version: 1, datos: {...} }`) y aplicar migración defensiva al leer.
- **Plantillas huérfanas** cuando un usuario se elimina. Mitigación: `ON DELETE SET NULL` en `usuario_id` + mostrar "Autor eliminado" en la lista.
- **Explosión de plantillas** por org. Mitigación: paginar la lista y limitar el combobox del paso 1 a las 20 más usadas.

### Orden de ejecución

1. Cierre P1 (fixes + tests + tooltips) — v13.294.1.
2. Migración SQL + RLS + GRANT — v13.295.0-alpha (feature flag off).
3. Hooks + RPC + tests unitarios.
4. `GuardarPlantillaDialog` conectado al éxito.
5. `PlantillaSelectorPaso1` conectado al paso 1.
6. Página `/cotizaciones/plantillas`.
7. Playwright E2E: crear plantilla → usarla → verificar contador.
8. Bump `APP_VERSION = 13.295.0` + CHANGELOG.

¿Le arranco así o prefieres que P2 sea "unificar Agregar concepto" primero (más limpieza técnica, menos ROI de negocio)?
