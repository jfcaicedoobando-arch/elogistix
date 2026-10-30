# Palette — aprendizajes críticos de UX/a11y

## 2026-10-30 - Botones de ícono con `size="sm"` en columnas de tablas
**Learning:** Casi todos los botones `size="icon"` ya tienen `aria-label`; el hueco aparece en acciones de tabla escritas con `size="sm"` y solo un ícono dentro de `defineColumns`, porque las búsquedas por `size="icon"` no las detectan.
**Action:** Auditar cualquier `<Button>` cuyo contenido sea solo ícono (sin importar el `size`) y nombrarlo con el registro de la fila, p. ej. `aria-label={\`Eliminar categoría ${c.nombre}\`}`, con el ícono en `aria-hidden`.
