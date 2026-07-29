## Diagnóstico (verificado en el código)

Encontré **dos problemas reales**, uno de configuración y uno de la propia pantalla de diagnóstico.

**1. Falta el DSN en el build (causa principal)**
`src/lib/observability/sentry/core.ts` línea 45 lee `import.meta.env.VITE_SENTRY_DSN`. Si está vacío, `initSentry()` se sale de inmediato y ni siquiera llama a `Sentry.init` (líneas 51–57). Revisé el `.env` del proyecto: **no contiene ninguna variable `VITE_SENTRY_*`** (sólo las de Supabase). Como Vite reemplaza estas variables *en tiempo de build*, el bundle publicado en librecarga.com salió con el DSN vacío → Sentry apagado.

Analogía: es una alarma bien instalada pero sin la línea telefónica conectada; suena internamente y nadie la recibe.

**2. Falso negativo en la pantalla `/sentry` (bug secundario)**
`src/lib/observability/hooks/useSentryInfo.ts` lee `Sentry.getClient()` dentro de un `useMemo(..., [])`, o sea **una sola vez en el primer render**. Pero en `main.tsx` el SDK se carga con `import()` dinámico, así que el cliente puede existir *después* de ese render. Resultado: aunque Sentry sí arranque, la tarjeta se queda congelada en "NO está inicializado" y los botones de prueba quedan deshabilitados. Este bug hay que arreglarlo igual, si no, no podremos confirmar que el fix 1 funcionó.

## Cambios propuestos

**A. Configurar el DSN**
- Agregar `VITE_SENTRY_DSN` (el valor que ya tienes) al `.env` del proyecto para que entre al build de producción.
- Dejar documentados en `.env.example` los overrides opcionales que el código ya soporta (`VITE_SENTRY_ENV`, `VITE_BUILD_HASH`, sample rates) — el archivo ya los lista, sólo se verifica que coincidan con lo que lee el código.

**B. Arreglar `useSentryInfo` (falso negativo)**
- Cambiar el `useMemo([])` por estado reactivo: leer `Sentry.getClient()` al montar y reintentar con un pequeño poll (o suscribirse al término de la carga diferida) hasta que el cliente exista, con un tope de intentos y `clearInterval` en el cleanup del efecto.

**C. Mensaje honesto en la pantalla de diagnóstico**
- Distinguir tres estados en lugar de dos:
  - **Activo** — hay cliente Sentry.
  - **Deshabilitado en desarrollo** — `import.meta.env.MODE === "development"` (comportamiento intencional; hoy se muestra como error rojo y confunde).
  - **No inicializado — falta DSN** — sin DSN configurado, con la indicación de qué variable falta.
- Mostrar una fila extra "DSN configurado en el build: sí/no" para que el diagnóstico se pueda hacer sin abrir la consola.

**D. Verificación**
- Build de producción y revisión del bundle para confirmar que el DSN quedó embebido.
- Tras publicar, entrar a `/sentry` en librecarga.com, confirmar el badge **Activo** y usar "Enviar error de prueba" para verificar que el evento llega al proyecto Sentry.

**E. Registro**
- Entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

## Nota técnica

No toco `core.ts` salvo que la verificación lo exija: la política de "sin DSN hardcodeado" y de no inicializar en desarrollo es intencional (documentada en el propio archivo, 13.310.0) y la mantengo.

## Lo que necesito de ti

Al aprobar el plan, pégame el DSN público de Sentry (empieza con `https://...@oXXXX.ingest.us.sentry.io/XXXX`). Es un valor público, seguro de vivir en el bundle del navegador — así lo documenta ya tu propio `.env.example`.
