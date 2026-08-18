# Preview en blanco: el bump de versión reinicia el servidor de desarrollo

## Causa raíz (verificada)

En el log del servidor se ve el patrón exacto, repetido cada vez que tocamos la versión:

```text
4:53:39 AM [vite] src/constants/appVersion.ts changed, restarting server...
4:53:39 AM [vite] server restarted.
```

El motivo está en `vite.config.ts` línea 8: importa `APP_VERSION` desde `src/constants/appVersion.ts`. Con eso, ese archivo pasa a ser **parte de la configuración** de Vite, y Vite reinicia el servidor completo cuando cambia — no hace un simple recargado en caliente.

Consecuencia en el preview embebido: el reinicio corta las peticiones en vuelo, y aparecen justo los errores reportados — `Failed to fetch dynamically imported module` en `Dashboard.tsx`, `Facturacion.tsx`, `Cotizaciones.tsx`, y el `GET /@vite/client 404` de `lovable.js`. En pestaña nueva funciona porque ahí recargas después del reinicio; el iframe del editor se queda con la sesión vieja y muerta.

Nota: la regla del proyecto es bumpear `APP_VERSION` en **cada** cambio, así que hoy el preview se rompe prácticamente en cada iteración.

## Qué se va a cambiar

1. Quitar el `import { APP_VERSION } from "./src/constants/appVersion"` de `vite.config.ts`. En su lugar leer la versión leyendo el archivo con `fs` y extrayéndola con una expresión regular, dentro de una función local. Así Vite ya no vigila ese archivo como dependencia de configuración y el bump de versión deja de reiniciar el servidor.
2. El único consumidor de ese valor en la configuración es el nombre del release de Sentry (`libre-carga@<versión>`) en builds de producción: se conserva idéntico. Si por alguna razón no se pudiera leer el archivo, se usa `libre-carga@unknown` y se emite un aviso, sin romper el build.
3. Prueba unitaria del lector de versión (que devuelva la versión vigente y no explote si el formato cambia).
4. Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Efecto para el usuario

El preview de Lovable deja de quedarse en blanco tras cada cambio: al bumpear la versión sólo se recarga el módulo afectado, no se reinicia el servidor. Los errores de "módulo dinámico" y el 404 de `@vite/client` desaparecen.

## Fuera de alcance

- No se cambia el flujo de versionado ni el `CHANGELOG` como práctica.
- No se toca la configuración de Sentry en runtime (`src/lib/observability/sentry/core.ts` seguirá usando `APP_VERSION` importado normalmente).
