# Plan: Reparar crash TypeError en /inicio (lectura de `.default` en undefined)

## Contexto
El usuario reportó un error en producción/preview (`id-preview--341dfc00...`) en la ruta `/inicio`:

```
TypeError: Cannot read properties of undefined (reading 'default')
```

No hay component stack. El stack minificado apunta a `assets/index-AGDnYbQJ.js:2:7626`, justo donde una función `Bt` intenta leer `.default` de un objeto indefinido, durante el renderizado de React. Esto suele indicar un import con default export ausente o un lazy-load cuyo módulo no resuelve el componente esperado.

## Objetivo
Eliminar el crash en `/inicio` sin ampliar alcance ni agregar features nuevos.

## Pasos

1. **Reproducir y localizar**
   - Navegar a `http://localhost:8080/inicio` con Playwright (autenticado si es necesario) y capturar consola/red.
   - Si el crash no se reproduce localmente con el código actual, comparar el build de preview (`AGDnYbQJ`) contra el working tree para ver si el error proviene de un import nuevo en los últimos commits.
   - Revisar `src/features/dashboard/routes/Dashboard.tsx` y todos sus imports directos, buscando imports `import X from '...'` donde el módulo exporta named, o viceversa.

2. **Auditar lazy imports y exports de Dashboard**
   - Verificar que `src/routes/appRoutes.lazy.ts` hace `lazy(() => import('@/features/dashboard/routes/Dashboard'))` y que `Dashboard.tsx` exporta por default.
   - Revisar `FinanceDashboard` y los componentes recientemente movidos o refactorizados (últimos commits `Changes` y merge de HigieneKpis) por exportaciones mixtas o archivos que ahora exportan named sin default.

3. **Diagnosticar el módulo roto**
   - Inspeccionar el chunk del dashboard o el bundle para identificar qué `import` genera la lectura de `.default`.
   - Buscar archivos vacíos, ciclos de import o re-exports de barril (`index.ts`) que apunten a un módulo sin default export.

4. **Corregir el import/export defectuoso**
   - Ajustar a named/default según corresponda, o agregar la exportación faltante.
   - Evitar cambios de comportamiento: solo reparar la resolución del módulo.

5. **Validar focalizadamente**
   - `bun run build` o typecheck focalizado en los archivos afectados.
   - Playwright en `/inicio` confirma que el dashboard carga sin el TypeError.
   - No ejecutar suites globales prohibidas en Lovable; dejar CI completo para GitHub Actions.

6. **Documentar**
   - Añadir bullet en `[Unreleased]` de `CHANGELOG.md`.
   - No modificar `APP_VERSION` ni `migration-manifest.json` (no hay cambio de base).

## Exclusiones
- No tocar RLS, base de datos, RPCs ni permisos.
- No refactorizar el dashboard ni agregar funcionalidad.
- No ejecutar CI/RLS/tests globales en Lovable.
