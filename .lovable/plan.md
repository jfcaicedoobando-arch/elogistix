Activar el tipo de contenedor 40' High Cube en el catálogo global.

Problema: El tipo de contenedor con código `40HC` y nombre `40' High Cube` ya existe en la tabla `tipos_contenedor`, pero está marcado como inactivo (`activo = false`). El hook `useTiposContenedor` (y `fetchTiposContenedor`) filtra por activos por defecto, por lo que no aparece en el selector de nuevas tarifas marítimas.

Acción:
1. Actualizar la tabla `tipos_contenedor` para marcar el registro con `code = '40HC'` como activo (`activo = true`).
2. Actualizar `CHANGELOG.md` y `APP_VERSION`.

No se requieren cambios de código ni de esquema.