## Resumen
Reemplazar los 3 archivos SVG de marca actuales (contenedor + globo) con el nuevo diseño propio del usuario: **bloques isométricos apilados + flecha curva ascendente + wordmark**. Mantener la integración existente en `BrandLockup.tsx`, nav, footer y schema.org sin cambios de comportamiento.

## Archivos a modificar

### 1. `public/librecarga-icon.svg` (isotipo, cuadrado)
- Extraer solo el grupo `<g id="LC_Icon">` del SVG del usuario (sin el `<text>`).
- Reajustar `viewBox` a cuadrado (ej. `0 0 120 120`) y centrar el icono.
- Preservar los colores exactos del usuario: `#1C3B6E` (oscuro), `#234C81` (claro), `#002D5B` (texto).
- Limpieza: remover las clases CSS internas `<style>` y aplicar `fill`/`stroke` inline directamente en cada `<path>`/`<polygon>` para máxima compatibilidad como archivo SVG autónomo.

### 2. `public/librecarga-logo.svg` (marca completa, reemplazo directo)
- Inicialmente idéntico a `librecarga-icon.svg`.
- Motivo: todos los consumidores actuales (`BrandLockup.tsx`, `LandingNav.tsx`, `LandingFooter.tsx`, `LogoPreview.tsx`, schema.org) lo usan como imagen de marca; `BrandLockup` renderiza el texto "Libre Carga" por separado vía `BRAND.name`.
- No incluir texto dentro del SVG para evitar duplicación con el DOM.

### 3. `public/librecarga-icon-light.svg` (variante para fondos oscuros)
- Misma geometría que el isotipo, pero con inversión de colores:
  - `#1C3B6E` → `#F8FAFC` (blanco)
  - `#234C81` → `#93C5FD` (azul claro)
- Garantizar contraste adecuado sobre el sidebar oscuro y headers dark mode.

### 4. Metadatos de versión
- `src/constants/appVersion.ts`: bump `13.21.3` → `13.21.4`.
- `CHANGELOG.md`: entrada `[13.21.4]` con descripción breve del reemplazo de marca.

## Validación
- Verificar `/login` (BrandLockup stacked) y sidebar colapsado (iconOnly) en preview.
- Confirmar que `LandingNav` y `LandingFooter` siguen mostrando la marca sin distorsión de aspecto.

## Notas técnicas
- No se toca `BrandLockup.tsx` ni `index.html`: los paths de archivo se mantienen (`/librecarga-logo.svg`, `/librecarga-icon.svg`, `/librecarga-icon-light.svg`).
- No nuevas dependencias: cambio puro de assets SVG.
