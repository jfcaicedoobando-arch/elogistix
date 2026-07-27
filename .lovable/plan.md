## Objetivo
Subir `sonner` de `1.7.4` a `2.0.7` (última). El proyecto ya está en React 19.2, así que cumple con el nuevo peer.

## Contexto verificado
- `package.json`: `"sonner": "1.7.4"` — última publicada `2.0.7`.
- Se usa en 8 archivos vía `from "sonner"` + wrapper propio en `src/components/ui/sonner.tsx` (posición, clases, `swipeDirections`, `swipeThreshold`).
- Existe wrapper `appFeedback` (regla del proyecto) — la migración a v2 es transparente para los llamadores que ya usan los helpers `notify*`.

## Cambios notables de Sonner 1 → 2
1. **Peer**: exige React ≥ 18.3; nuestro stack (React 19.2) califica.
2. **Firma de `promise()`**: `success`/`error` reciben `(data)` — ya así lo usamos donde aplica.
3. **`swipeDirections`** ahora es prop oficial en `<Toaster>` (ya no requiere `@ts-expect-error` para `swipeThreshold` — v2 lo tipa). Revisar y quitar el `@ts-expect-error` si TS ya lo acepta.
4. **Class hooks**: los `data-[type=…]` que usamos siguen soportados; no requieren cambio.
5. **Close button**: v2 cambia ligeramente el layout interno — revisar visualmente el override `!left-auto !right-2 !top-2`.

## Pasos
1. `bun add sonner@2.0.7`.
2. `bun run lint` + `tsgo` + `bun run test` (unit) para detectar rupturas de tipos/API.
3. Smoke visual: disparar un toast success, error, warning, info y uno con `action` desde la app en preview (fullHD) para validar borde izquierdo, icono, close button y swipe.
4. Si TS ya acepta `swipeThreshold` en `toastOptions`, remover el `@ts-expect-error` de `src/components/ui/sonner.tsx` (línea 30). Si no, dejarlo.
5. Bump `APP_VERSION` a `13.320.21` y entrada en `CHANGELOG.md` con analogía.

## Riesgos
- Bajo. El wrapper concentra el estilo; los llamadores usan `appFeedback` (helper `notify*`), no la API cruda. El único punto sensible son los overrides `!` de `closeButton` si v2 cambia posición del botón.

## Rollback
- `bun add sonner@1.7.4` revierte en un paso; no hay migraciones ni cambios de datos.