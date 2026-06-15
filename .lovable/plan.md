# Nuevo logo: Contenedor + Globo

Reemplazar el isotipo actual por un pictograma de **contenedor de carga envuelto por un globo terráqueo**, manteniendo paleta navy `#1B2B4B` + azul `#2563EB` sobre fondo claro `#F8FAFC`.

## Cambios

1. **`public/librecarga-icon.svg`** — Nuevo SVG vectorial (200x200):
   - Círculo (globo) con meridianos sutiles en navy.
   - Contenedor isométrico al frente: cara izquierda navy, cara derecha azul, líneas verticales blancas tipo "corrugado".
   - Geometría limpia, sin sombras, escalable a 16px (favicon) y 512px.

2. **`public/librecarga-logo.svg`** — Versión horizontal que reusa el isotipo nuevo (sin texto, solo el ícono optimizado para headers).

3. **`public/librecarga-icon-light.svg`** — Variante con trazos en azul brillante `#60A5FA` para fondos oscuros.

4. **`public/favicon.svg`** (si existe) — Sincronizar con el nuevo isotipo.

5. **Changelog + versión**
   - `src/constants/appVersion.ts` → `13.21.3`
   - `CHANGELOG.md` → entrada `[13.21.3]` describiendo el rediseño del isotipo.

## Validación

- Capturar `/login` y el sidebar en preview para verificar legibilidad del nuevo logo en ambos contextos (header oscuro y light).

## Notas técnicas

- Sin dependencias nuevas; SVG inline puro.
- El ícono se construye con `<circle>` + `<path>` (sin imágenes raster).
- Compatible con todos los puntos donde ya se referencian estos archivos (no se renombran rutas).
