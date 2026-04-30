Plan para corregir el sidebar vacío en móvil

El problema viene de que el sidebar móvil abre el panel completo, pero el contenido se está renderizando como si estuviera colapsado. Por eso se ven los íconos, pero no los nombres de las secciones ni de los componentes.

Cambios propuestos:

1. Corregir `AppSidebar`
   - Usar el estado `isMobile` del sidebar.
   - En móvil, forzar el contenido a renderizarse como expandido aunque el estado desktop esté colapsado.
   - Mantener el comportamiento actual en escritorio/tablet: colapsado muestra solo íconos, expandido muestra íconos + textos.

2. Ajustar visualmente el drawer móvil
   - Confirmar que el logo, nombre de organización, grupos, opciones del menú, usuario y versión se muestren dentro del drawer móvil.
   - Mantener tooltips solo cuando realmente esté colapsado en escritorio.

3. Validar navegación y cierre
   - Verificar que los links del menú sigan navegando correctamente.
   - Revisar que el botón de menú siga abriendo/cerrando el sidebar móvil.

4. Actualizar versión y changelog
   - Subir la versión a `v8.99.55`.
   - Agregar una entrada nueva al changelog indicando la corrección del sidebar móvil.

Archivos a modificar:

- `src/components/layout/AppSidebar.tsx`
- `src/constants/appVersion.ts`
- `src/content/changelogData.ts`
- `src/content/changelog/v8/chunks/0.ts`

Detalle técnico:

Actualmente se calcula así:

```ts
const { state } = useSidebar();
const collapsed = state === "collapsed";
```

La corrección será equivalente a:

```ts
const { state, isMobile } = useSidebar();
const collapsed = !isMobile && state === "collapsed";
```

Así, cuando el usuario abre el menú en celular, el drawer se verá completo con nombres y secciones, aunque el sidebar desktop haya quedado guardado como colapsado.