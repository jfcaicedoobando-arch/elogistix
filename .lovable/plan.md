# Publicar control de catálogos globales por empresa (13.823.222)

## Contexto
En la versión actual del preview (13.823.222), dar de alta o eliminar puertos, navieras y tipos de contenedor ya es exclusivo del dueño de la plataforma. Los administradores de empresa solo ven el interruptor "Visible en mi empresa". Lo que el equipo vio fue la versión publicada anterior (13.823.219), que aún no tenía este cambio.

## Decisión confirmada
Solo la plataforma da de alta elementos del catálogo. Las empresas no proponen ni agregan; solo prenden/apagan para sí mismas.

## Alcance
1. Verificar que los tres catálogos (puertos, navieras, tipos de contenedor) ocultan alta y eliminación global a quien no es dueño de la plataforma — TabPuertos ya verificado (formulario de alta y botón eliminar protegidos con `isSuperAdmin`); revisar TabNavieras y TabTiposContenedor y ajustar solo si falta el mismo corte.
2. Validación focalizada: typecheck + ESLint de archivos tocados (si se toca algo) y build.
3. Publicar la versión 13.823.222 para que producción deje de mostrar el error "No tienes permisos para activar o desactivar puertos" y los admin de empresa dejen de ver el formulario de alta.

## Fuera de alcance
- No se crean flujos de propuesta/aprobación de nuevos puertos.
- No se tocan migraciones, datos históricos ni CI/RLS globales (quedan para GitHub Actions).

## Detalles técnicos
- Guarda existente: `isSuperAdmin` de `usePermissions()` envuelve formulario de alta y botón eliminar en `TabPuertos.tsx` (líneas 67-73, 83-98).
- El apagado por empresa usa `catalogo_org_desactivado` (ya migrado) y los servicios `setActivoOrg` / `fetchDesactivadosOrg`.
