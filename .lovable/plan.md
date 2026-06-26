## Reordenar tab "Garantías y Demoras"

Invertir el orden de las secciones en `src/features/embarques/components/EmbarqueDetalleTabs.tsx` (líneas 154-165) para que Demoras aparezca primero y Garantías después.

### Cambios
1. **`EmbarqueDetalleTabs.tsx`**: mover la `<section seccion-demoras>` (con `SeccionDemorasAuto` + `TabDemoras`) arriba del `<Separator />`, y la `<section seccion-garantias>` debajo.
2. *(Opcional)* Renombrar el trigger del tab de "Garantías y Demoras" a "Demoras y Garantías" para reflejar el nuevo orden. ¿Lo hago?
3. Bump `APP_VERSION` y agregar entrada en `CHANGELOG.md`.

No se toca lógica ni estilos, sólo el orden visual.