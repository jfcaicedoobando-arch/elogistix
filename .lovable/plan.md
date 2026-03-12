

## Plan: Limpieza de código — Eliminar Reportes

### CAMBIO 1 — Eliminar `src/pages/Reportes.tsx`
Borrar el archivo completo.

### CAMBIO 2 — Limpiar `src/App.tsx`
- **Línea 25**: Eliminar `const Reportes = lazy(() => import("./pages/Reportes"));`
- **Línea 68**: Eliminar `<Route path="/reportes" element={<Reportes />} />`

### Verificación
Confirmado: no hay referencias a Reportes en el sidebar (`AppSidebar.tsx` no lo incluye en `menuItems` ni `adminItems`). No se toca ningún otro archivo.

