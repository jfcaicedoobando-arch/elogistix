# jsdom 31: controles de dependencias y compatibilidad

## Alcance

Corrección aislada sobre PR #454, commit `3ad3c1b65c61856f769121ba6845303f498947a6`, base `42d6b9e514720c1f055330c77cfdd7e6d839cb90`. Se conservan sin modificación el `package.json` y `bun.lock` de ese PR, incluido jsdom 31.0.0. No cambia configuración de Vitest, exclusiones, umbrales, gates, migraciones ni despliegues.

El fallo reproducido no es una vulnerabilidad nueva: jsdom 31 retiró `css-tree`, pero dos pruebas seguían resolviendo ese consumidor inexistente. Evidencia original: https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/42623370188/job/129181054329.

## Cambios

- El control de `source-map-js` conserva familia 1.x y mínimo 1.2.2, resuelto desde consumidores activos: PostCSS raíz, PostCSS de Tailwind legado y magicast. Se comprueba que cada uno declara la dependencia, satisface su rango y conserva la ida y vuelta de mapas y contenido fuente. No hay `try/catch`, skip o fallback que silencie una dependencia ausente.
- Un contrato explícito documenta la retirada de las antiguas dependencias CSS y el peer opcional `@napi-rs/canvas` de jsdom 31. No se instala un backend nativo que la aplicación no utiliza.
- El contrato de parser bloquea un script con respuesta sintética, confirma el árbol parcial, espera `DOMContentLoaded` antes de leerlo y `window.load` para finalización. También cubre el fast path de `readyState` cuando ya ocurrieron los eventos. El interceptor responde a todos los recursos; no contacta servicios externos.
- Cuatro regresiones de Vitest cubren selectores escapados/compuestos y mutaciones, estilos computados vivos con variables CSS/cambios de reglas, accesibilidad y visibilidad durante apertura/cierre repetido de un portal React, y atributos DOM de canvas.
- La inspección de `src` y `scripts` no encontró consumidores de canvas nativo, registro de fuentes canvas ni JSDOM manual fuera de estos contratos. Los `toBlob()` de PDF son de `@react-pdf/renderer`; no requieren el backend de canvas de jsdom. No se afirma equivalencia de rasterizado o bytes de imágenes.

## Validación local

Node 26.13.0 y Bun 1.4.4, iguales a los pins del repositorio.

- Instalación limpia: `bun install --frozen-lockfile --ignore-scripts`, 746 paquetes, lock sin cambios.
- Antes: `bun run test:dependencies`, 23/25 pasan; ambos fallos son `Cannot find module 'css-tree'`.
- Después: el mismo comando, 27/27 pasan, sin skips.
- ESLint de los dos archivos de pruebas modificados: pasa con `--max-warnings=0`.
- Vitest focalizado: 25/25 pruebas en cuatro archivos: nuevo contrato, `ConfirmActionDialog`, `DoubleConfirmDeleteDialog` y `DialogEditarCliente.reset`, con dos workers.
- ESLint global, typecheck y build local terminaron con SIGKILL durante presión de recursos. No se declaran aprobados; el build llegó a transformar 8559 módulos. La primera corrida amplia de jsdom con ocho workers se interrumpió para repetir con dos, sin alterar la configuración del repositorio.
- La verificación global y el estado del commit publicado deben consultarse en Actions del PR. Ningún resultado focalizado sustituye ese gate.
