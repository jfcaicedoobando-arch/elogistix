# Actualización segura de dependencias

Actualizar solo el grupo seguro (parches y menores dentro del stack permitido), sin tocar ninguna versión mayor prohibida por los pines de la plataforma.

## Qué se actualiza

- `@tanstack/react-virtual` 3.14.9 → 3.14.10
- `libphonenumber-js` 1.13.10 → 1.13.11
- `lucide-react` 1.31.0 → 1.33.0
- `nuqs` 2.9.5 → 2.10.0
- `papaparse` 5.5.4 → 5.6.0
- `react-router-dom` 6.30.4 → 6.30.6 (nos quedamos en v6)
- `@react-pdf/renderer` (último parche de la línea actual)

## Qué NO se toca

- React 19, Vite 8, Tailwind 4, TypeScript 6, react-router 7: prohibidos por los pines de la plataforma.
- `date-fns` 4, `recharts` 3, `@hookform/resolvers` 5 y otras mayores: requieren revisión de breaking changes; se dejan para un sprint aparte.

## Verificación

1. Instalar el grupo seguro con el gestor del proyecto.
2. Correr lint, typecheck y la suite de tests completa.
3. Build de producción y revisión del log de errores de build.
4. Revisión visual rápida de una pantalla con tablas/íconos (lucide) y una con PDF, por ser las dependencias con más superficie visual.
5. Si algo falla, revertir solo el paquete culpable y reportarlo.

## Registro

- Bump de `APP_VERSION` a la siguiente versión de parche y entrada breve en `CHANGELOG.md` describiendo la actualización de dependencias.
