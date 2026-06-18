## Plan: Arreglar clickeo del botón "Ver detalles" en toasts de error (mobile)

### Contexto
El usuario reporta que en mobile no puede hacer click/tap en el botón **"Ver detalles"** de los toasts de error (los que abren el `ErrorDetailsDialog`). Esto impide revisar el payload de debug cuando algo falla en la app.

### Diagnóstico
1. **Tap target < 44px**: Sonner renderiza el `actionButton` con padding fijo de ~8px, dando un área táctil de ~30×20px — muy por debajo del estándar P0 recién aplicado.
2. **Swipe-to-dismiss intercepta taps**: Sonner pone `touch-action: none` en `[data-sonner-toast]` y escucha `touchstart`/`touchmove` para swipe. Si el dedo se mueve unos píxeles al tocar "Ver detalles", el toast se descarta sin disparar `onClick`.
3. **Clases CSS rotas**: En `sonner.tsx`, `group-[.toaster]` nunca se aplica porque el contenedor de Sonner usa `data-sonner-toaster`, no la clase `.toaster`. Esto hace que los estilos `error`/`success`/`warning`/`info` (fondos/colores) nunca se activen, degradando el contraste visual del botón de acción.

### Cambios

#### P1. Corregir clases CSS del `<Toaster>` (`src/components/ui/sonner.tsx`)
- Reemplazar `group-[.toaster]` por `group-data-[type=error]` / `group-data-[type=success]` etc. en las claves `error`, `success`, `warning`, `info`.
- Asegurar que `actionButton` tenga `min-h-[44px] min-w-[44px]` y un padding amplio en mobile (`px-4 py-2`) para que el tap target sea ≥44px.

#### P2. Prevenir swipe-to-dismiss en toasts con acción (`src/components/ui/sonner.tsx`)
- Añadir `cancelOnMovement={false}` o `swipeThreshold={100}` (o desactivar swipe para toasts de error con `action`).
- Alternativa más segura: cambiar la estrategia de interacción en mobile para que los toasts de error con `action` requieran un click explícito en el botón de cerrar (`closeButton`) en vez de swipe.

#### P3. Hacer el botón de acción más prominente (`src/components/shared/utils/appFeedback.ts`)
- Añadir `cancelButton` al lado de `action` para que el layout de Sonner lo trate como una acción explícita y le dé más espacio.
- Verificar que `duration: Infinity` no cause problemas con el ciclo de vida del `onClick`.

#### P4. Verificación visual con Playwright
- Forzar un toast de error con acción en viewport 390×844.
- Medir el bounding box del botón "Ver detalles": debe ser ≥44×44px.
- Confirmar que hacer tap en el centro del botón abre el `ErrorDetailsDialog`.

### Metadata
- Bump `APP_VERSION` y `CHANGELOG.md`.

### Alcance
- Sólo toca `sonner.tsx`, `appFeedback.ts`, y tests Playwright de verificación.
- No se modifica `ErrorDetailsDialog.tsx` ni `errorDetailsStore.ts` (su lógica es correcta).