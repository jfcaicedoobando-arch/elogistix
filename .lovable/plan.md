## Objetivo

Añadir un botón **"Capturar pantalla"** dentro del modal de reportar bug/mejora que tome un screenshot del viewport actual y lo adjunte como una imagen más del reporte, usando la librería [`modern-screenshot`](https://github.com/qq15725/modern-screenshot).

## Dependencia

```
bun add modern-screenshot
```

~30 KB minified+gzip. Importación lazy (`await import("modern-screenshot")`) — sólo se carga cuando el usuario hace clic en el botón, no en el bundle inicial.

## Cambios

### 1. Nuevo helper `src/lib/feedback/screenshot.ts`

```ts
import { APP_VERSION } from "@/constants/appVersion";

const PICKER_IDS = new Set([
  "feedback-picker-overlay",
  "feedback-picker-label",
  "feedback-picker-hint",
]);

export async function captureViewport(): Promise<File> {
  const { domToBlob } = await import("modern-screenshot");
  const blob = await domToBlob(document.documentElement, {
    scale: Math.min(window.devicePixelRatio, 2),
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#fff",
    filter: (node) => {
      if (!(node instanceof Element)) return true;
      if (PICKER_IDS.has(node.id)) return false;
      // Excluir el modal del feedback para no fotografiar el form encima
      if (node.closest?.("[data-feedback-modal]")) return false;
      return true;
    },
  });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return new File([blob], `captura-${ts}.png`, { type: "image/png" });
}
```

### 2. Marcar el modal con `data-feedback-modal`

En `src/components/feedback/FeedbackDialog.tsx`, añadir el atributo al `DialogPrimitive.Content` para que el filtro lo excluya:

```tsx
<DialogPrimitive.Content data-feedback-modal ...>
```

### 3. Botón "Capturar pantalla" en `FeedbackImageUploader.tsx`

Añadir un segundo `Button` junto a "Adjuntar imagen". Necesita:

- Aceptar prop opcional `onCapture?: () => Promise<File | null>` (la lógica de ocultar el modal vive arriba, en `FeedbackForm`, para tener acceso a `onPickerActiveChange`).
- Estado interno `capturing` para deshabilitar y mostrar "Capturando…".

```tsx
{onCapture && (
  <Button
    type="button"
    variant="outline"
    size="sm"
    disabled={value.length >= MAX_IMAGES || capturing}
    onClick={async () => {
      setCapturing(true);
      try {
        const file = await onCapture();
        if (file) addFiles([file]);
      } finally {
        setCapturing(false);
      }
    }}
  >
    <Camera className="h-4 w-4 mr-1.5" />
    {capturing ? "Capturando…" : "Capturar pantalla"}
  </Button>
)}
```

### 4. Orquestar en `FeedbackForm.tsx`

Pasar `onCapture` al uploader. La función:

1. Llama `onPickerActiveChange?.(true)` para ocultar el modal (reusa la lógica que ya teníamos para el picker: `opacity:0 pointer-events-none` + sin overlay).
2. `await new Promise(r => setTimeout(r, 250))` para que el DOM repinte sin el modal.
3. `const file = await captureViewport()`.
4. `onPickerActiveChange?.(false)` para restaurar el modal.
5. Si falla, mostrar toast de error y devolver `null`.

```tsx
const handleCapture = useCallback(async (): Promise<File | null> => {
  onPickerActiveChange?.(true);
  try {
    await new Promise((r) => setTimeout(r, 250));
    return await captureViewport();
  } catch (e) {
    toast({ title: "No se pudo capturar la pantalla", description: (e as Error).message, variant: "destructive" });
    return null;
  } finally {
    onPickerActiveChange?.(false);
  }
}, [onPickerActiveChange, toast]);
```

### 5. Versionado

- `src/constants/appVersion.ts` → `8.229.0`.
- `src/content/changelog/v8/chunks/0.ts` — entrada minor `8.229.0`.

## Verificación

1. Abrir modal → clic **Capturar pantalla** → el modal desaparece ~250 ms, se toma la captura, vuelve a aparecer con el PNG adjunto en la grilla.
2. La captura **no** muestra el modal ni los overlays del picker.
3. Funciona en /embarques, /facturacion y demás rutas (incluye contenido scrolleado visible en el viewport).
4. Si se llega a 3 imágenes, el botón queda deshabilitado.
5. Bundle inicial no aumenta significativamente (verificable con devtools network: `modern-screenshot` aparece sólo al hacer clic).

## Archivos modificados / nuevos

**Nuevos:**
- `src/lib/feedback/screenshot.ts`

**Modificados:**
- `src/components/feedback/FeedbackDialog.tsx` — añadir `data-feedback-modal`.
- `src/components/feedback/FeedbackForm.tsx` — `handleCapture` + pasar `onCapture` al uploader.
- `src/components/feedback/FeedbackImageUploader.tsx` — botón "Capturar pantalla" (opcional via prop).
- `package.json` — `modern-screenshot`.
- `src/constants/appVersion.ts` → `8.229.0`.
- `src/content/changelog/v8/chunks/0.ts` — entrada `8.229.0`.

## Notas

- El picker visual y la captura comparten el patrón "ocultar modal + restaurar"; no se duplica lógica.
- `modern-screenshot` captura sólo el viewport visible (no `scrollHeight` completo) porque pasamos `document.documentElement` con el scroll actual. Si más adelante queremos página completa, basta cambiar a `domToBlob(document.documentElement, { height: document.documentElement.scrollHeight })`.
