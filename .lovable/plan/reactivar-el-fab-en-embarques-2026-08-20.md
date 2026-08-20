# Reactivar el FAB en Embarques

El botón flotante (FAB) de Embarques se eliminó en la Ola G porque estaba duplicado e inactivo. La pantalla todavía reserva el espacio inferior para él (`pb-24` en móvil), pero hoy en móvil no hay forma directa de iniciar un embarque: el botón "Nuevo embarque" sólo aparece en escritorio y el menú "Más acciones" únicamente lo ofrece cuando el usuario NO puede crear directamente.

## Qué se va a hacer

1. **Componente compartido `MobileFab`** (nuevo, reutilizable): botón circular fijo abajo a la derecha, visible sólo en móvil (`md:hidden`), con tokens del sistema (color primario, sombra, `aria-label` obligatorio y área táctil de 56px). Así queda consistente con el resto de la UI y disponible para otros módulos.
2. **Embarques usa el FAB con la acción correcta**:
   - Si el usuario puede crear embarques → abre el alta de embarque (misma acción que el botón de escritorio).
   - Si no puede crear directamente → ejecuta el flujo guiado "se crean desde una cotización" (mismo aviso y navegación que hoy).
   - No se muestra en el estado vacío (ahí ya existe su propio llamado a la acción).
3. **Limpieza de duplicados**: se retira del menú móvil "Más acciones" la entrada "Nuevo embarque", para que exista un único punto de entrada en móvil (el FAB) y "Exportar CSV" quede en el menú.
4. Se conserva el `pb-24` inferior para que el FAB no tape la última fila.

## Detalles técnicos

- Nuevo archivo `src/components/shared/MobileFab.tsx` (Button `size="icon"` con `className` de posición fija `fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg`), props: `onClick`, `label`, `icon` opcional (default `Plus`).
- `src/features/embarques/routes/Embarques.tsx`: render del FAB después de `CargaGuard`, condicionado a `!isEmptyState`, llamando `goNuevo` o `goNuevoDesdeCotizacion` según `canCrear`.
- `src/features/embarques/components/EmbarquesHeaderActions.tsx`: quitar el `DropdownMenuItem` de "Nuevo embarque".
- Verificación: lint (incluye la regla a11y de etiquetas), tipos, tests, y captura de pantalla móvil con Playwright para confirmar que el FAB no tapa contenido.
- `CHANGELOG.md` + `APP_VERSION` → 13.694.1.
