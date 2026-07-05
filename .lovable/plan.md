## Qué está pasando

El "círculo rojo de no acceso" es el cursor `not-allowed` que el navegador muestra sobre elementos deshabilitados. En la tabla de proformas, el checkbox se **deshabilita** en las filas que **no se pueden fusionar en factura** (proformas ya facturadas o rechazadas). El shadcn `Checkbox` tiene por defecto `disabled:cursor-not-allowed`, y por eso aparece ese ícono al pasar el mouse.

Analogía: es como un botón de elevador apagado — el sistema te avisa "aquí no puedes hacer clic".

## Propuesta

En lugar de mostrar un checkbox deshabilitado (que se ve como error), **ocultar el checkbox** en las filas no seleccionables y dejar la celda vacía. Así el usuario entiende de un vistazo que esas filas simplemente no participan en la selección múltiple, sin el ícono rojo alarmante.

Adicionalmente, agregar un `title` (tooltip nativo) en las filas seleccionables para dejar claro qué hace el checkbox: *"Seleccionar para fusionar en una factura"*.

### Cambios

- **`src/features/facturacion/components/proformasColumns.tsx`** (columna `_select`, ~línea 40-55):
  - Si `!selectable` → renderizar `null` (celda vacía) en vez del checkbox deshabilitado.
  - Si `selectable` → mantener el checkbox actual y agregar `title="Seleccionar para fusionar en una factura"`.

### Fuera de alcance

- No se toca la lógica de `isConvertible` ni el hook controller.
- No se cambia el componente `Checkbox` global (afectaría a toda la app).

## Verificación

- Hover sobre filas facturadas/rechazadas → sin ícono rojo (celda vacía).
- Hover sobre filas pendientes/aceptadas → cursor pointer normal, checkbox operativo, tooltip visible.
- Lint + tests (`useTabProformasController.test.tsx` sigue pasando: no depende del render).

## Changelog

Bump `APP_VERSION` a `13.172.2` y agregar entrada en `CHANGELOG.md` describiendo el fix de UX.