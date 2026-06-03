## Contexto

En `ELIMP00102` el contenedor `BEAU4808252` sigue intacto en la base — el borrado quedó en estado local del formulario. Como confirmaste que reapareció al recargar, **no hay nada que restaurar**.

Resta endurecer el workflow para que un clic accidental al ícono de basurero no elimine la fila sin confirmación.

## Cambio

Agregar un diálogo de confirmación al botón de eliminar contenedor en `SeccionContenedores` (vista detalle del embarque). Sólo afecta esa pantalla; el wizard queda igual.

### Comportamiento

- Al hacer clic en el basurero de una fila se abre un `AlertDialog` simple:
  - Título: "¿Eliminar contenedor #N?"
  - Descripción: "Se quitará el contenedor «{numero}» ({tipo}) de la lista. El cambio se aplica al presionar Guardar cambios."
  - Botones: Cancelar / Eliminar (destructivo).
- Al confirmar se ejecuta el `onDelete` actual (quita la fila del borrador local).
- Si la fila está vacía (sin número ni tipo) se elimina directamente sin diálogo, para no estorbar cuando el usuario agregó una fila por error.

### Por qué AlertDialog sencillo y no el `DoubleConfirmDeleteDialog`

El borrado de la fila es reversible (sólo afecta el borrador local hasta presionar Guardar) → un solo paso es suficiente. El doble confirm escribiendo "ELIMINAR" se reserva para borrados destructivos en BD.

## Archivos

- `src/components/embarque/contenedores/FilaContenedor.tsx` — envolver el botón Trash en `AlertDialog`, con shortcut para filas vacías.
- `CHANGELOG.md` — entrada `12.51.9`.
- `src/constants/appVersion.ts` — bump a `12.51.9`.

## Fuera de alcance

- Wizard de Nuevo/Editar embarque (no se toca).
- Restauración de datos en BD (no se requiere).
- Bitácora de eliminación de contenedores (sigue dependiendo del Guardar; la confirmación previa basta).
