# components/ui — shadcn/ui (read-only)

Estos archivos son componentes generados por **shadcn/ui** y deben permanecer
sin modificar.

## Reglas

1. **No editar directamente.** Si necesitas variar comportamiento o estilo,
   crea un wrapper en otra carpeta (`components/<feature>/`).
2. **Solo se actualizan vía CLI** de shadcn cuando se introduce una versión
   nueva.
3. **Excepciones documentadas**: si por motivos de tema (HSL tokens) hubo que
   tocar un archivo, deja un comentario `// LIBRECARGA: ...` en la línea
   editada para hacerlo trazable.

## ¿Por qué?
Mantener estos archivos prístinos garantiza que podamos migrar a versiones
nuevas de shadcn sin conflictos manuales.
