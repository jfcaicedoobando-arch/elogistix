# Mantenimiento del stack de build y pruebas

Revisión del repositorio: **2026-10-05**. Stack: Vite 8, Vitest 5, Router 7,
TypeScript 6. [CI](ops/ci.md) es la guía de jobs/triggers.

## Dependabot y dependencias Edge

`.github/dependabot.yml` cubre Actions y el `package.json`/`bun.lock` del
frontend. React/DOM/tipos, Router y Vitest/`@vitest/*` tienen grupos propios,
separando major de minor/patch. La agrupación no acredita compatibilidad ni
fusiona PRs automáticamente.

[GitHub admite Deno](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories#deno)
mediante `imports` en `deno.json`/`deno.jsonc` para paquetes npm/JSR. Pero en
este repo las versiones Edge están escritas en imports `npm:`/HTTP. Los
`deno.json` actuales configuran JSX o están vacíos, sin un mapa `imports`.
El bloque Bun no actualiza esas referencias, aunque el mismo paquete también
exista en el frontend. No se declara cobertura automática de Edge.

Inventario directo observado el **2026-10-05**; confirmar siempre los imports
antes de actualizar, no usar esta tabla como lockfile ni catálogo de versiones
más nuevas. No incluye dependencias transitivas.

| Familia Edge | Versión/referencia observada | Revisión requerida |
| --- | --- | --- |
| Supabase JS | `https://esm.sh/@supabase/supabase-js@2.45.0`; preview usa `npm:@supabase/supabase-js@2/cors` | Revisar ambos canales; el segundo no fija una versión exacta. No sustituir HTTP por npm junto con un upgrade. |
| FacturAPI | `npm:facturapi@5.1.0` en `_shared/facturapiClient.ts` | SDK/adaptador y contratos I/E/P, idempotencia y recuperación; pruebas fiscales sólo en Sandbox autorizado. |
| Sentry Deno | `npm:@sentry/deno@10.76.0` en `_shared/sentryRuntime.ts` | Confirmar runtime remoto; el pin homónimo en `package.json` no actualiza el import. No subir Edge a SDK 11 sólo porque CI use Deno nuevo. |
| React de correos | React/DOM y `@types/react` `18.3.1` | Mantener familia y JSX compatibles; no heredar React 19 del frontend. |
| React Email / correo Lovable | `@react-email/components@0.0.22`, `@lovable.dev/email-js@0.1.0` | Renderizar plantillas sin enviar correos y revisar contratos del proveedor. |
| Zod de cobranza | `npm:zod@3.23.8` | Validaciones de los dos handlers CxC; no copiar Zod 4 del frontend sin adaptar y probar. |
| std por HTTP | `0.168.0/http/server.ts`; asserts `0.208.0`/`0.224.0`, dotenv `0.224.0` | Separar runtime de utilidades de pruebas; pasar a JSR o `Deno.serve` es otra modificación, no un bump mecánico. |

### Procedimiento mínimo

Revisar mensualmente y ante avisos de seguridad, sin otro bot, cron ni
pipeline. Usar registros, changelogs y guías oficiales; no inferir que un pin
antiguo es vulnerable sólo por su edad. Para ubicar referencias:

```bash
rg -n --glob '*.ts' --glob '*.tsx' 'from .*(npm:|https://)|import\(.(npm:|https://)' supabase/functions
rg -n --glob 'deno.json' 'jsxImportSource|"types"|"imports"' supabase/functions
```

1. Elegir una familia y verificar compatibilidad con el runtime desplegado.
2. Cambiar sólo esa familia y sus tipos; conservar transporte y permisos.
3. Ejecutar tests/check locales focales con `DENO_NO_PACKAGE_JSON=1`, versión
   CLI de CI y `--node-modules-dir=none`, sin `--no-check` ni omitir sanitizers.
4. Enviar PR: CI activa Deno por cambios en `supabase/functions/`. Un resultado
   correcto no acredita despliegue ni compatibilidad remota; validar el flujo
   afectado en el entorno autorizado antes de publicar.

`deno outdated` consulta los manifiestos; no detecta nuestros imports
inline. No usar `deno outdated --update` en la raíz como solución: puede
actuar sobre `package.json` del frontend, que es otra iniciativa.
Ver [alcance del comando](https://docs.deno.com/runtime/reference/cli/outdated/).

### Automatización nativa: siguiente iniciativa, no habilitada

Si se decide automatizar Edge, probar primero una función no fiscal:
manifiesto con dependencias realmente consumidas, CI local equivalente y
despliegue validado. Después añadir `package-ecosystem: deno` para ese
directorio y extenderlo por etapas. No crear un manifiesto espejo que
Dependabot actualice sin cambiar el código ejecutado.

Supabase [recomienda un `deno.json` por función](https://supabase.com/docs/guides/functions/dependencies#using-denojson-recommended),
no una configuración global como solución de despliegue. Resolver también
imports compartidos, JSX y tipos: duplicar un manifiesto no actualiza los
pins de `_shared`. Revisar Dependency Review/graph para el nuevo alcance;
su workflow actual sólo dispara por dependencias del frontend.

Los inputs de versión del CLI Deno/Bun y el digest Postgres se mantienen
manualmente: actualizar una acción de setup no actualiza esos valores.
Ver [CI](ops/ci.md) para separar CLI de pruebas y runtime remoto.

## Build

`vite.config.ts` conserva Terser. No se mantienen `manualChunks` históricos.
Sourcemaps de producción sólo con token Sentry y sin `BUILD_SOURCEMAPS=false`;
se suben y eliminan del dist. Sin token se desactivan y se advierte.
`check-sourcemaps.sh` verifica el dist tras build en el job de comprobaciones.

`build:low-mem` desactiva maps; no cambia reglas del producto.
El tamaño/RAM de un build deben medirse en su entorno real.

## Coverage

CI principal usa **cinco shards sin coverage**.
No hay workflow nightly de coverage vigente. Medición optativa:

- `bun run test:coverage`.
- `test:coverage:shard -- --shard=N/TOTAL` con el mismo TOTAL en todas las partes.
- `test:coverage:merge` une blobs y aplica thresholds del total.
- `coverage:report` genera resumen.

No confundir `test:ci` (alias de merge de coverage) con el comando real de CI.

## Vitest/Router

Proyectos node/jsdom definidos explícitamente con `extends: false` para
evitar herencia/duplicación de plugins. Benchmarks `perf` están separados.
`clearMocks: false` es una decisión de compatibilidad de la suite.

Preparación para Router 8, etapa 1: el frontend conserva `react-router@7.18.4`
y `nuqs/adapters/react-router/v7`, pero usa imports canónicos de `react-router`.
Se retiró la dependencia directa `react-router-dom`; las APIs específicas
`RouterProvider`/`HydratedRouter`, si se necesitan, se importan de `react-router/dom`.
No se cambió el modo declarativo, el árbol de rutas ni la versión del ERP.

Los dos aliases ESM canónicos de Router evitan doble contexto CJS/ESM con nuqs.
El contract test comprueba layout, versión instalada y ausencia de imports
legacy en app/mocks/fixtures; no eliminar aliases por estética. La prueba de
filtros nuqs usa `BrowserRouter`, el router soportado oficialmente, y conserva
la revisión de enlaces, redirects, historial y estado de formularios/Sentry.
Router 8 y su adaptador nuqs v8 se evaluarán como una etapa posterior separada.

Validación local de esta etapa (2026-10-05): 599 pruebas en 148 archivos,
TypeScript, ESLint sin warnings, build y seis guardias estáticas de BD.
En navegador, fixtures aislados sin backend verificaron enlaces, filtros,
recarga, atrás/adelante y conservación de un formulario al cambiar la URL;
listado/modal revisados a 1280×720 y 691×763. No acredita publicación.
`testEnvSplit.ts` reparte archivos; un `@vitest-environment` explícito manda.

## Recharts 3

El frontend fija `recharts@3.10.1`. La migración desde 2.15.4 conserva los
cálculos y formatos del ERP: el dominio de rentabilidad acepta límites
`readonly`, la cuadrícula de auditoría usa explícitamente el eje `left` y
las ocho leyendas tienen un orden estable por `dataKey`, alineado con sus
series (no el nuevo orden alfabético por defecto).

`RechartsCompatibility.test.tsx` comprueba la cuadrícula con dos escalas,
leyendas, pérdidas, sectores/etiquetas de pastel y tooltip por teclado con
Recharts real. Sólo fija tamaño y desactiva animaciones en jsdom; no sustituye
una revisión de layout/animaciones en navegador. Se mantiene la accesibilidad
activada por defecto en Recharts 3.

El contrato de flujo vive junto a `GraficoFlujoProyectado` en tesorería;
no se expone el componente por su barrel público sólo para importarlo en un
test compartido. Comprueba también la leyenda cuando no hay saldo disponible.

Validación local del 2026-10-05: 225 pruebas focales en 39 archivos,
TypeScript, ESLint sin warnings, build y seis guardias estáticas de BD.
Comparación visual aislada con 2.15.4: 18 componentes reales, temas claro y
oscuro, Desktop HD 1280×720 y revisión estrecha 691×763, estados vacíos/carga
y valores negativos. Los datos se inyectaron en fixtures temporales sin
backend, retirados después; no acredita publicación ni un recorrido completo
con roles/datos remotos. Los budgets de bundle y sourcemaps se conservaron.

Para futuros upgrades, usar la
[guía oficial de migración](https://github.com/recharts/recharts/wiki/3.0-migration-guide)
y repetir estas pruebas; no resolver incompatibilidades con casts ni
desactivar la accesibilidad para recuperar una captura anterior.

## Evidencia histórica

El ensayo de minificadores del 2026-09-19 midió Terser 67 s / 355–364 KB gzip
frente a esbuild 48 s / 376 KB. Son datos del stack/entorno de entonces,
no un benchmark de Vite 8 ni budgets actuales garantizados.
[Historia de shards](ci-vitest-shards.md).

No se cambió configuración ni se repitieron benchmarks en esta actualización.
