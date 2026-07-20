## Diagnóstico

**Analogía:** El embarque ELIMP00333 sí tiene "novia" (COT-2026-0138) — la vinculación existe en BD. El problema es que el formulario de **editar** llega a la pantalla como si estuviera soltero y encima el buscador sólo muestra "solteras disponibles" (estado `Aceptada`), no las que ya están casadas con un embarque (estado `En operación`).

### Verificado con lecturas previas

- **BD:** `embarques.cotizacion_id = 5fe12c7f-…` apunta correctamente a COT-2026-0138.
- **COT-2026-0138** está en estado `En operación` (correcto — así quedó desde v13.303.16 cuando se creó el embarque).
- **`EditarEmbarque.tsx`** llama a `StepDatosGenerales` **sin pasar** `cotizacionVinculada`, `cotizacionesAceptadas`, ni los handlers de vincular/desvincular. Sin esos props:
  - `cotizacionVinculada` queda `undefined` → aparece el banner "Cotización requerida" y el label rojo.
  - El botón "Buscar cotización aceptada…" se muestra vacío.
- **`fetchCotizacionesAceptadas`** filtra `.eq("estado", "Aceptada")` — como COT-2026-0138 ya está en `En operación`, nunca aparecería en el dropdown aunque el edit lo llenara.

### Causa raíz

El wizard de "Editar embarque" **nunca hidrata la vinculación de cotización**. Fue diseñado como si la vinculación sólo existiera al crear. Al agregar en v13.303.16 el cambio de estado `Aceptada → En operación`, el problema se hizo visible: no hay forma de "re-vincular" la misma cotización porque ya no está en la lista de aceptadas.

---

## Plan de arreglo (v13.303.23)

### 1. Hidratar la cotización vinculada al editar

En `useEditarEmbarqueWizard`:
- Leer `embarque.cotizacion_id`.
- Con `useCotizacion(embarque.cotizacion_id)` obtener el registro completo.
- Exponer `cotizacionVinculada` (y opcionalmente `handleDesvincularCotizacion` reutilizando `useNuevoEmbarqueCotVinculada` o un helper equivalente).

En `EditarEmbarque.tsx`:
- Pasar `cotizacionVinculada`, `cotizacionesAceptadas` (vía `useCotizacionesAceptadas`) y los handlers a `StepDatosGenerales`.

Resultado: el usuario ve el badge verde "✓ Vinculada a COT-2026-0138 — Cliente" y el banner de "Cotización requerida" desaparece.

### 2. Incluir cotizaciones "En operación" en el buscador

En `fetchCotizacionesAceptadas` (`src/features/cotizacion/services/queries.ts`):
- Cambiar `.eq("estado", "Aceptada")` por `.in("estado", ["Aceptada", "En operación"])`.

Motivo: si el usuario **desvincula** en el edit y quiere re-vincular la misma cotización, debe seguir apareciendo. También cubre el caso de re-uso legítimo cuando un embarque se elimina y la cotización queda "En operación" temporalmente.

### 3. Ajustar tests afectados

- `src/features/cotizacion/services/__tests__/queries.test.ts`: actualizar assertion del `.eq("estado", …)` → `.in("estado", […])`.
- Agregar test en `EditarEmbarque` / `useEditarEmbarqueWizard` que verifique que `cotizacionVinculada` se hidrata desde `embarque.cotizacion_id`.

### 4. Versión y changelog

- `APP_VERSION` → `13.303.23`.
- Entrada en `CHANGELOG.md`.

### Archivos a tocar

```text
src/features/embarques/hooks/useEditarEmbarqueWizard.ts   ← hidratar cotización + handlers
src/features/embarques/routes/EditarEmbarque.tsx          ← pasar props al Step
src/features/cotizacion/services/queries.ts               ← .in(["Aceptada","En operación"])
src/features/cotizacion/services/__tests__/queries.test.ts
src/features/embarques/hooks/__tests__/useEditarEmbarqueWizard.test.tsx  (nuevo o extendido)
src/constants/appVersion.ts
CHANGELOG.md
```

### Fuera de alcance

- No se toca la máquina de estados de cotizaciones ni la BD.
- No se cambia el comportamiento del wizard "Nuevo embarque".
- No se modifica la política de qué roles requieren cotización obligatoria.