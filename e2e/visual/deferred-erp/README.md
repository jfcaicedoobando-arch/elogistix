# Deferred ERP: pruebas locales y GUI aislada

Base inicial: `9af3859fabd6e57343cb5fadd4494a0a14579cb2`. Se incorporó `main`
`b02c3391a97ea7d54b0a6b0b514c4626738ab639` conservando íntegro el PR387 de Knip.
Frente a esa base se añade este harness y el registro mínimo del catálogo con
su prueba de regresión; no modifica producción, package/lock, Knip, permisos
ni datos. La evidencia final se repitió sobre el árbol integrado.
`AGENTS.md` y `src/features/crm/AGENTS.md` se leyeron; `.agents/skills` no existe
en esta base/clon. El patrón de aislamiento es `../audit119-126`.

## Ejecutar

Usar las dependencias del lockfile y su Chromium de Playwright; no usar un
perfil de navegador existente. En esta máquina se copiaron dependencias ya
instaladas a un `node_modules` independiente, sin ejecutar install scripts.
TEMP/TMP deben apuntar a `test-results/temp` si Windows restringe el temporal.

```powershell
New-Item -ItemType Directory -Force test-results/temp,reports/deferred-erp | Out-Null
$env:TEMP = Join-Path $PWD 'test-results/temp'
$env:TMP = $env:TEMP
node node_modules/typescript/bin/tsc -p e2e/visual/deferred-erp/tsconfig.json
node node_modules/eslint/bin/eslint.js --no-cache e2e/visual/deferred-erp
node node_modules/vite/bin/vite.js build --config e2e/visual/deferred-erp/vite.config.ts
node node_modules/@playwright/test/cli.js test --config e2e/visual/deferred-erp/playwright.config.ts
node node_modules/tsx/dist/cli.mjs e2e/visual/deferred-erp/xml-parser-local.mjs
node e2e/visual/deferred-erp/run-deno-original.mjs
```

Suites existentes, con entorno vacío y cliente Supabase fail-closed:

```powershell
node node_modules/vitest/vitest.mjs run --config e2e/visual/deferred-erp/vitest.config.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=reports/deferred-erp/unit-results.json src/features/costeo/services/__tests__/extraerTarifasCorreo.test.ts src/features/costeo/services/__tests__/importacionTarifasCorreo.test.ts src/features/costeo/tarifario/__tests__/ExtraerCorreoDialog.test.tsx src/features/crm/services/__tests__/vinculosCrm.test.ts src/features/crm/components/objetos/__tests__/VinculosCard.test.tsx src/features/cxp/components/__tests__/DialogNotaCreditoProveedor.identidad.test.tsx src/features/cxp/hooks/__tests__/useCargaCfdi.test.tsx
```

Después de una ejecución completa se puede consolidar la evidencia:

```powershell
node e2e/visual/deferred-erp/collect-evidence.mjs
```

El recolector ejecuta de nuevo typecheck, ESLint y build. Sólo publica `passed`
con códigos de salida reales iguales a cero, sin señal ni error de proceso.
`validation-results.json` registra comandos, tiempos, hashes de logs y de
fuentes antes/después. Un fallo, resultado ausente o cambio de fuentes deja el
resumen en `failed`; se invalida el resumen previo al iniciar la ejecución.

## Cobertura

- Correo PR372: `ExtraerCorreoDialog`, servicios de lectura/preparación/selección
  y parser reales. Correo inventado inline; adaptador y escritores en memoria.
  Preparación sin escrituras; conflictos y catálogos paginados después de 1000;
  fallo de segunda página bloquea carga/altas; catálogos inactivos globales y
  por organización; selección explícita conserva UUID preparado; cambio de
  organización invalida resultados y exige extracción nueva. Documento existente:
  `docs/testing/importacion-tarifas-correo.md`.
- CRM PR373: `VinculosCard`, hook y servicio reales. Para contacto y oportunidad:
  enlace activo; nombre/etiqueta histórica sin anchor; embeds nulos omitidos;
  controles sólo con edición/configuración; dos bajas exactas de vínculos en
  memoria sin tocar empresas ni otros dueños.
- XML96 GUI: diálogo, campos y `useCargaCfdi` reales, parser y escritor en
  memoria. Identidad coincidente habilita prefill/Registrar; identidad ausente o
  distinta bloquea; rechazo visible; captura manual disponible; retirar XML
  elimina UUID, validación y ambos adjuntos. Reelegir exige procesarlo nuevamente.
- XML local: parser/validador reales con el XML ficticio inline ya existente;
  relaciones, identidad, UUID, tipo, moneda, total y duplicados con cliente de
  sólo lectura en memoria. `xml-parser-local.mjs` usa Node/tsx existentes.

La GUI tiene 26 casos, 13 por viewport (1280x720 y 390x640), reloj/idioma/zona fijos,
sin retries ni skips. Capturas y JSON prueban comportamiento, no comparación
contra un baseline de píxeles ni una certificación de producción/staging.

Los tres specs están registrados por ruta exacta en el catálogo como
`playwright-isolated` con `mode: manual`. El workflow `Isolated UI audit`
actual sólo ejecuta los otros cinco fixtures; no ejecuta `deferred-erp`.
La evidencia de estos 26 casos corresponde a la ejecución local de Chromium.

## Aislamiento y límites

Vite independiente: `publicDir:false`, directorio env vacío, sin sourcemaps ni
config de aplicación. Alias reemplazan fronteras de backend; el build rechaza
bootstrap, main/App, persistBootstrap, cliente real Supabase y SDK Supabase/Sentry.
La UI usa feedback real Sonner con transporte de telemetría sustituido.
Los escritores simulados comprueban organización/factura, preparación, modo y
payload exactos antes de registrar efectos; también rechazan altas no usadas,
UUIDs inesperados y adjuntos que no correspondan al contenido ficticio.

Sólo se sirve el build estático en `127.0.0.1:8097`. Playwright lanza su Chromium
headless aislado, bloquea service workers, WebSockets y toda petición fuera de
GET a los archivos del fixture. CSP niega conexiones, workers, formularios,
objetos y base externa. Los JSON guardan rutas de solicitudes sin queries,
headers, cookies ni variables de entorno. Todo dato es ficticio.

La suite original
`supabase/functions/parse-cfdi-xml/validarNcProveedor_test.ts` pasó sus **3 tests**
con Deno **2.9.7**, la versión fijada por `.github/workflows/ci.yml:272`.
La propuesta inicial 2.5.6 se descartó para conservar esa paridad. Tras la
autorización explícita del usuario se descargó una vez el ZIP oficial desde
`https://github.com/denoland/deno/releases/download/v2.9.7/deno-x86_64-pc-windows-msvc.zip`;
su SHA256 coincide con el digest publicado por la API oficial de GitHub:
`a0c3101b4158d1dfb7d6a78a7bf0f3de80c96bb423c152beec8beb22786f2238`.

El ejecutable y la caché están aislados bajo `test-results/xml-deno-runtime`
y `test-results/xml-deno-cache`. Sólo se copió la caché pública existente de
`deno.land` y `esm.sh`; la ejecución usa `--cached-only`, sin descargar módulos.
El comando exacto, versión, procedencia, hashes de fuentes, log y JUnit están
en `evidence/deno-original-results.json`. El runner conserva typecheck y ambos
sanitizadores, sin configuración/lockfile automáticos, con entorno permitido
sólo para el runtime y todos los permisos de aplicación denegados:

```text
deno test --no-config --no-lock --cached-only --node-modules-dir=none --sanitize-ops --sanitize-resources --no-prompt --check --deny-env --deny-net --deny-read --deny-write --deny-run --deny-ffi --deny-sys --junit-path=reports/deferred-erp/deno-original.junit.xml supabase/functions/parse-cfdi-xml/validarNcProveedor_test.ts
```

El recolector verifica hashes y fuentes y analiza el JUnit como XML sin
scripts ni recursos externos. Exige los tres nombres originales únicos;
rechaza comentarios como casos, CDATA, duplicados, XML malformado y DOCTYPE.

La adquisición autorizada del runtime se distingue de la ejecución del test,
que no tuvo permisos de red ni secretos. El parser de la GUI sigue simulado;
las 22 aserciones Node son una comprobación separada y su propio reporte
conserva `denoSuiteExecuted: false` porque ese script no ejecuta Deno.
No se acreditan ACL/RLS ni estado fiscal reales. No se consultaron Gmail,
backend, BD, SAT ni servicios de timbrado; no hubo registro, borrado, subida,
merge del PR o despliegue reales.

`evidence/` contiene un resumen JSON, aserciones/red por caso, capturas sintéticas
y logs de validación. Los reportes completos temporales quedan ignorados en
`reports/deferred-erp/` y `test-results/deferred-erp/`.

Las regresiones de registro manual y evidencia se verifican por separado de las
100 pruebas funcionales originales. La comprobación auxiliar completa
`ciTestEvidence.test.ts` tuvo cuatro fallos locales de plataforma en Windows:
un contrato lee YAML suponiendo LF y tres contratos requieren Bash ausente.
No se modificaron ni omitieron esos controles; el resultado se conserva en
`evidence/catalog-registration.json` junto con las regresiones del clasificador.

El escaneo histórico de Gitleaks del commit `05eb8b86d` reportó un falso
positivo en el digest público del ZIP documentado arriba. `.gitleaks.toml`
extiende únicamente `generic-api-key`: exige esta ruta exacta y las dos líneas
completas con ese digest, mediante condición `AND`. No excluye archivos,
directorios, commits ni valores por sí solos, y mantiene las reglas default.
La configuración del head cubre el bloque histórico sin reescribir commits.
Los controles de ruta, contexto, digest y credencial sintética adicional
quedan en `scripts/ci/test_gitleaks_snapshot.py`; CI exige el CLI real 8.24.3.
El diagnóstico original se conserva en
`evidence/validation/gitleaks-history-before.txt`.

La excepción sólo admite el formato LF publicado. Los probes CRLF y sin salto
final permanecen detectados: el campo `Line` del CLI 8.24.3 puede retener CR o
truncarse al final del match, por lo que no se amplía el patrón a contexto
incompleto. Se conservan los 28 escenarios: dos permitidos y 26 detecciones.
Referencia: [delimitación de líneas en el detector fijado](https://github.com/gitleaks/gitleaks/blob/v8.24.3/detect/detect.go#L377-L393).
